// Server side of time-off and swap decisions (B5): who may decide (the homes a
// request touches and their B2 approval settings, needs-approvers.ts), and the
// swap's reassignment. The reassignment is the same guarded write saveShift
// makes: the rule engine (shift-guard.server.ts) with the new person on the
// shift, then a shift_changes row when the shift was published
// (shift-change.server.ts). Runs as the calling user; requests.functions.ts
// checks scheduling edit first.
import { nextStatus } from "./board-model.ts";
import { canApprove, homesOfShifts, approvalHome, type ApprovalKind } from "./needs-approvers.ts";
import { rows } from "./rule-staff-facts.server.ts";
import { snapshotOf } from "./shift-change.ts";
import { recordShiftChange, SNAPSHOT_COLUMNS } from "./shift-change.server.ts";
import { guardShiftRows, SHIFT_COLUMNS, type ShiftRowIn } from "./shift-guard.server.ts";
import { isOwner } from "../access/levels.ts";
import type { MemberAccess } from "../access/member.ts";
import { addDaysKey, parseLocalDate } from "./time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

type Placed = { team_id: string | null; client_id: string | null };

/** Refuses unless the caller approves this kind for every home the shifts belong to. */
export async function requireApprover(
  db: Db,
  orgId: string,
  userId: string,
  access: MemberAccess,
  kind: ApprovalKind,
  shifts: readonly Placed[],
): Promise<void> {
  const owner = isOwner(access.level);
  if (owner) return;
  const clientIds = [...new Set(shifts.map((s) => s.client_id).filter((x): x is string => !!x))];
  const [teams, settings, clients] = await Promise.all([
    rows<{ id: string; team_name: string; team_type: string | null; manager_id: string | null }>(
      db.from("teams").select("id, team_name, team_type, manager_id").eq("organization_id", orgId),
    ),
    rows<{ team_id: string; swap_approval: string | null; timeoff_approval: string | null }>(
      db
        .from("team_schedule_settings")
        .select("team_id, swap_approval, timeoff_approval")
        .eq("organization_id", orgId),
    ),
    clientIds.length
      ? rows<{ id: string; team_id: string | null }>(
          db.from("clients").select("id, team_id").in("id", clientIds),
        )
      : Promise.resolve([] as Array<{ id: string; team_id: string | null }>),
  ]);
  const homes = new Map(
    teams.map((t) => [t.id, approvalHome(t, settings.find((s) => s.team_id === t.id) ?? null)]),
  );
  const clientHome = new Map(clients.map((c) => [c.id, c.team_id]));
  const verdict = canApprove(
    kind,
    { userId, isOwner: owner },
    homesOfShifts(shifts, clientHome, homes),
  );
  if (!verdict.ok) throw new Error(verdict.reason);
}

/** A person's live shifts on the days of a time-off request (inclusive). */
export async function shiftsOnDays(
  db: Db,
  orgId: string,
  staffId: string,
  from: string,
  to: string,
): Promise<Placed[]> {
  return rows<Placed>(
    db
      .from("scheduled_shifts")
      .select("team_id, client_id")
      .eq("organization_id", orgId)
      .eq("staff_id", staffId)
      .neq("status", "cancelled")
      .gte("starts_at", parseLocalDate(from).toISOString())
      .lt("starts_at", parseLocalDate(addDaysKey(to, 1)).toISOString()),
  );
}

export type SwapShift = ShiftRowIn & { id: string; published: boolean };

export async function loadSwapShift(db: Db, orgId: string, shiftId: string): Promise<SwapShift> {
  const { data, error } = await db
    .from("scheduled_shifts")
    .select(`${SHIFT_COLUMNS}, published`)
    .eq("id", shiftId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That shift no longer exists.");
  if (data.status === "cancelled") throw new Error("That shift was cancelled.");
  return data as SwapShift;
}

/** Puts `toStaff` on the shift through the rule engine and records the change. */
export async function reassignShift(
  db: Db,
  orgId: string,
  userId: string,
  shift: SwapShift,
  toStaff: string,
  reason: string | null,
): Promise<string[]> {
  const status = nextStatus(
    { status: shift.status ?? "draft", published: shift.published, staff_id: shift.staff_id },
    toStaff,
  );
  const warnings = await guardShiftRows(db, orgId, [{ ...shift, staff_id: toStaff, status }], {
    reason,
  });
  const { data: written, error } = await db
    .from("scheduled_shifts")
    .update({ staff_id: toStaff, status, ...(reason ? { override_reason: reason } : {}) })
    .eq("id", shift.id)
    .eq("organization_id", orgId)
    .select(SNAPSHOT_COLUMNS);
  if (error) throw new Error(error.message);
  if (!written?.length) throw new Error("That shift wasn't changed: you can't edit it.");
  await recordShiftChange(db, orgId, userId, shift.id, snapshotOf(shift), written[0]);
  return warnings;
}
