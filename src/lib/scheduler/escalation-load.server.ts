// What the escalation ladder reads (escalation.ts), for one shift or every
// shift the scheduler tick looks at: each agency's B2 settings, the ladder
// events so far, and who each step would ask: the home's lead
// (teams.manager_id; a client visit uses the client's home), whoever has an
// on-call shift (shift_type 'oncall') covering the start, the owners, and the
// people who could stay (holdover.ts). Service role: callers check access
// first (escalation*.functions.ts) or are the cron tick.
import {
  MEMBER_ACCESS_SELECT,
  resolveMemberAccess,
  type MemberAccessRow,
} from "../access/member.ts";
import { decodeEvent, type Candidates, type EventRow, type LadderEvent } from "./escalation.ts";
import { holdoverCandidates, type HoldShift, type HoldoverRecordRow } from "./holdover.ts";
import { rows } from "./rule-staff-facts.server.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const ESC_SHIFT_COLUMNS =
  "id, organization_id, staff_id, client_id, team_id, service_code, starts_at, ends_at, status, published, claim_requested_by, shift_type, parent_shift_id, van_route_id";

export type EscShift = HoldShift & {
  organization_id: string;
  service_code: string | null;
  claim_requested_by: string | null;
  parent_shift_id: string | null;
  van_route_id: string | null;
};

export type EscSettings = {
  waits: number[];
  holdoverAsk: boolean;
  holdoverVisible: boolean;
  urgentHours: number;
};
const DEFAULTS: EscSettings = {
  waits: [15, 15, 10],
  holdoverAsk: true,
  holdoverVisible: true,
  urgentHours: 4,
};

export async function loadEscSettings(db: Db, orgIds: string[]): Promise<Map<string, EscSettings>> {
  const list = orgIds.length
    ? await rows<{
        organization_id: string;
        escalation_waits: number[];
        holdover_ask: boolean;
        holdover_visible: boolean;
        urgent_hours: number;
      }>(
        db
          .from("org_shift_behavior_settings")
          .select("organization_id, escalation_waits, holdover_ask, holdover_visible, urgent_hours")
          .in("organization_id", orgIds),
      )
    : [];
  return new Map(
    orgIds.map((id) => {
      const r = list.find((x) => x.organization_id === id);
      return [
        id,
        r
          ? {
              waits: r.escalation_waits,
              holdoverAsk: r.holdover_ask,
              holdoverVisible: r.holdover_visible,
              urgentHours: r.urgent_hours,
            }
          : DEFAULTS,
      ];
    }),
  );
}

/** Each shift's ladder events, oldest first. */
export async function loadLadderEvents(
  db: Db,
  shiftIds: string[],
): Promise<Map<string, LadderEvent[]>> {
  const out = new Map<string, LadderEvent[]>();
  if (!shiftIds.length) return out;
  const list = await rows<EventRow & { scheduled_shift_id: string }>(
    db
      .from("callout_escalation_events")
      .select(
        "scheduled_shift_id, step, channel, target_role, target_user_id, outcome, detail, created_at",
      )
      .in("scheduled_shift_id", shiftIds)
      .order("created_at"),
  );
  for (const r of list) {
    const e = decodeEvent(r);
    if (e) out.set(r.scheduled_shift_id, [...(out.get(r.scheduled_shift_id) ?? []), e]);
  }
  return out;
}

/** Every hold-over on record in these agencies (shift_changes kind 'holdover'). */
export async function loadHoldoverRecords(
  db: Db,
  orgIds: string[],
): Promise<Array<HoldoverRecordRow & { organization_id: string }>> {
  if (!orgIds.length) return [];
  const list = await rows<{
    organization_id: string;
    affected_staff_ids: string[];
    changed_at: string;
    reason: string | null;
  }>(
    db
      .from("shift_changes")
      .select("organization_id, affected_staff_ids, changed_at, reason")
      .in("organization_id", orgIds)
      .eq("kind", "holdover"),
  );
  return list.flatMap((r) =>
    r.affected_staff_ids.map((staffId) => ({
      organization_id: r.organization_id,
      staffId,
      at: r.changed_at,
      reason: r.reason,
    })),
  );
}

export type LadderFacts = {
  candidates: Candidates;
  /** The home's name for texts ("" for a client visit with no home). */
  place: string;
  /** Hold-over candidate → the shift of theirs that would be extended. */
  holdShift: Map<string, string>;
};

export async function loadLadderFacts(
  db: Db,
  shifts: readonly EscShift[],
  now: Date,
): Promise<Map<string, LadderFacts>> {
  const out = new Map<string, LadderFacts>();
  if (!shifts.length) return out;
  const orgIds = [...new Set(shifts.map((s) => s.organization_id))];
  const starts = shifts.map((s) => s.starts_at).sort();
  const clientIds = [...new Set(shifts.map((s) => s.client_id).filter((x): x is string => !!x))];
  const ids = shifts.map((s) => s.id);
  const [clients, members, nearby, records, callouts] = await Promise.all([
    clientIds.length
      ? rows<{ id: string; team_id: string | null }>(
          db.from("clients").select("id, team_id").in("id", clientIds),
        )
      : [],
    rows<MemberAccessRow & { user_id: string; organization_id: string }>(
      db
        .from("organization_members")
        .select(`user_id, organization_id, ${MEMBER_ACCESS_SELECT}`)
        .in("organization_id", orgIds)
        .eq("active", true)
        .is("deleted_at", null),
    ),
    // On-call shifts covering a start, and shifts ending at one (hold-overs).
    rows<EscShift>(
      db
        .from("scheduled_shifts")
        .select(ESC_SHIFT_COLUMNS)
        .in("organization_id", orgIds)
        .not("staff_id", "is", null)
        .neq("status", "cancelled")
        .eq("published", true)
        .lte("starts_at", starts[starts.length - 1])
        .gte("ends_at", starts[0]),
    ),
    loadHoldoverRecords(db, orgIds),
    rows<{ scheduled_shift_id: string; staff_id: string }>(
      db
        .from("shift_callouts")
        .select("scheduled_shift_id, staff_id")
        .in("scheduled_shift_id", ids)
        .neq("status", "cancelled"),
    ),
  ]);
  const homeOf = (s: EscShift) =>
    s.team_id ?? clients.find((c) => c.id === s.client_id)?.team_id ?? null;
  const homeIds = [...new Set(shifts.map(homeOf).filter((x): x is string => !!x))];
  const teams = homeIds.length
    ? await rows<{ id: string; team_name: string; manager_id: string | null }>(
        db.from("teams").select("id, team_name, manager_id").in("id", homeIds),
      )
    : [];
  const active = new Set(members.map((m) => `${m.organization_id}:${m.user_id}`));

  for (const s of shifts) {
    const org = s.organization_id;
    const ok = (id: string | null | undefined): id is string => !!id && active.has(`${org}:${id}`);
    const exclude = new Set(
      callouts.filter((c) => c.scheduled_shift_id === s.id).map((c) => c.staff_id),
    );
    const home = teams.find((t) => t.id === homeOf(s)) ?? null;
    const start = new Date(s.starts_at).getTime();
    const oncall = nearby
      .filter(
        (x) =>
          x.organization_id === org &&
          x.shift_type === "oncall" &&
          new Date(x.starts_at).getTime() <= start &&
          new Date(x.ends_at).getTime() > start,
      )
      .map((x) => x.staff_id);
    const owners = members
      .filter((m) => m.organization_id === org && resolveMemberAccess(m).level === "owner")
      .map((m) => m.user_id);
    const holds = holdoverCandidates(
      s,
      nearby.filter((x) => x.organization_id === org && ok(x.staff_id)),
      records.filter((r) => r.organization_id === org),
      now,
      exclude,
    );
    const lead = ok(home?.manager_id) && !exclude.has(home!.manager_id!) ? home!.manager_id : null;
    out.set(s.id, {
      candidates: {
        lead,
        oncall: oncall.filter((id): id is string => ok(id) && !exclude.has(id)),
        owners: owners.filter((id) => !exclude.has(id)),
        holdover: holds.map((h) => h.staffId),
      },
      place: home?.team_name ?? "",
      holdShift: new Map(holds.map((h) => [h.staffId, h.shiftId])),
    });
  }
  return out;
}
