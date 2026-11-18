// Loads one week's Publish / Send changes checklist (publish-plan.ts) from the
// database: the week's shifts, its unsent shift_changes (a change counts for
// the week when the shift was or is in it), the agency's overtime threshold,
// and the rule engine's findings for the drafts and changed shifts
// (checkShiftRows in shift-guard.server.ts; no checks of its own). Called by
// previewPublish and sendChanges (publish.functions.ts). Runs as the caller.
import { publishPlan, type PlanShift, type PublishPlan } from "./publish-plan.ts";
import { collapseChanges, type ChangeRow } from "./shift-change.ts";
import { checkShiftRows, SHIFT_COLUMNS, type ShiftRowIn } from "./shift-guard.server.ts";
import { weekDays } from "./board-model.ts";
import { addDaysKey, dayKey, toLocalRange } from "./time.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type WeekShift = ShiftRowIn & PlanShift & { open_spots: number | null };

const COLUMNS = `${SHIFT_COLUMNS}, published, override_reason, open_spots`;

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}

export async function loadPublishPlan(
  db: Db,
  orgId: string,
  week: string,
): Promise<{ plan: PublishPlan; byId: Map<string, WeekShift> }> {
  const days = weekDays(week);
  const { startIso, endExclusiveIso } = toLocalRange(week, addDaysKey(week, 6));
  const [shiftRes, changeRes, settings] = await Promise.all([
    db
      .from("scheduled_shifts")
      .select(COLUMNS)
      .eq("organization_id", orgId)
      .gte("starts_at", startIso)
      .lt("starts_at", endExclusiveIso),
    db
      .from("shift_changes")
      .select("id, shift_id, affected_staff_ids, before, after, changed_at")
      .eq("organization_id", orgId)
      .is("sent_at", null),
    db
      .from("org_shift_behavior_settings")
      .select("ot_threshold_hours")
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  const shifts = must<WeekShift[]>(shiftRes);
  const inWeek = (iso: string) => days.includes(dayKey(iso));
  const changes = must<ChangeRow[]>(changeRes).filter(
    (c) => inWeek(c.before.starts_at) || inWeek(c.after.starts_at),
  );
  // A shift moved out of the week still belongs to this week's send.
  const known = new Set(shifts.map((s) => s.id));
  const missing = [...new Set(changes.map((c) => c.shift_id).filter((id) => !known.has(id)))];
  if (missing.length)
    shifts.push(
      ...must<WeekShift[]>(await db.from("scheduled_shifts").select(COLUMNS).in("id", missing)),
    );
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const base = {
    shifts,
    changes: collapseChanges(changes),
    otHours: Number(settings.data?.ot_threshold_hours ?? 40),
    weekDays: days,
  };
  const toCheck = publishPlan({ ...base, findings: [] }).checked.map((id) => byId.get(id)!);
  const { findings } = await checkShiftRows(db, orgId, toCheck);
  return { plan: publishPlan({ ...base, findings }), byId };
}
