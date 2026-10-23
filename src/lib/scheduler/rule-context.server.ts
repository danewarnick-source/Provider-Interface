// Loads the facts the rule engine reads (a RuleContext, rules-types.ts) for a
// set of proposed shifts, from the owner tables. The only place that builds a
// RuleContext from the database; shift-guard.server.ts calls it for saving,
// publishing, claiming and clocking in. Runs as the calling user, so RLS
// applies; client authorizations come through client_authorizations_for_rules
// because staff (claim, clock-in) can't read client_billing_codes.
// Facts with no source table yet (absences, custody, forms 929/930, ratios
// confirmed per group, preferences) stay unset and their rules skip.
import { ageOn } from "../team-members/badges.ts";
import { loadActiveExclusions } from "../clients/team/exclusions-check.server.ts";
import type {
  Authorization,
  ClientFacts,
  ClientRatioEntry,
  RuleContext,
  RuleShift,
  Strength,
} from "./rules-types.ts";
import { addDaysKey, dayKey, toLocalRange, weekStartKey } from "./time.ts";
import { loadStaff, rows } from "./rule-staff-facts.server.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** A shift as the scheduled_shifts table holds it (new rows have no id yet). */
export type ShiftRowIn = {
  id?: string | null;
  staff_id: string | null;
  client_id: string | null;
  team_id?: string | null;
  service_code: string | null;
  starts_at: string;
  ends_at: string;
  parent_shift_id?: string | null;
  status?: string | null;
  van_route_id?: string | null;
  shift_type?: string | null;
};

export function toRuleShift(r: ShiftRowIn, fallbackId: string): RuleShift {
  return {
    id: r.id ?? fallbackId,
    staffId: r.staff_id,
    clientId: r.client_id,
    teamId: r.team_id ?? null,
    code: (r.service_code ?? "").trim().toUpperCase(),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    parentShiftId: r.parent_shift_id ?? null,
    status: r.status ?? null,
    vanRouteId: r.van_route_id ?? null,
    shiftType: r.shift_type ?? null,
  };
}

const uniq = (xs: Array<string | null | undefined>) => [
  ...new Set(xs.filter((x): x is string => !!x)),
];

/** "1:3" → one staff for three clients. */
function parseRatio(code: string, raw: string | null): ClientRatioEntry | null {
  const m = /^(\d+):(\d+)$/.exec((raw ?? "").trim());
  return m ? { code, staff: Number(m[1]), clients: Number(m[2]), confirmed: true } : null;
}

type AuthRow = {
  client_id: string;
  service_code: string;
  service_start_date: string | null;
  service_end_date: string | null;
  authorization_approved_on: string | null;
  worksheet_weekly_hours: number | null;
  ratio: string | null;
};

async function loadClients(
  db: Db,
  orgId: string,
  ids: string[],
): Promise<Record<string, ClientFacts>> {
  if (!ids.length) return {};
  const [clients, auths, team, exclusions] = await Promise.all([
    rows<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      date_of_birth: string | null;
      has_abi: boolean | null;
      team_id: string | null;
    }>(
      db.from("clients").select("id, first_name, last_name, date_of_birth, has_abi, team_id").in("id", ids),
    ),
    rows<AuthRow>(db.rpc("client_authorizations_for_rules", { _client_ids: ids })),
    rows<{ client_id: string; staff_id: string; service_codes: string[] | null }>(
      db
        .from("staff_assignments")
        .select("client_id, staff_id, service_codes")
        .eq("organization_id", orgId)
        .in("client_id", ids),
    ),
    loadActiveExclusions(db, orgId),
  ]);
  const today = dayKey(new Date());
  const out: Record<string, ClientFacts> = {};
  for (const c of clients) {
    const mine = auths.filter((a) => a.client_id === c.id);
    const members = team.filter((t) => t.client_id === c.id);
    const excluded = exclusions.filter((e) => e.client_id === c.id);
    out[c.id] = {
      id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "This client",
      age: ageOn(c.date_of_birth, today),
      hasAbi: !!c.has_abi,
      homeId: c.team_id,
      authorizations: mine.map((a): Authorization => ({
        code: a.service_code.trim().toUpperCase(),
        startDate: a.service_start_date ?? "0001-01-01",
        // An end date of that day or earlier closes the code (clients/services/authorizations.ts authorizationState).
        endDate: a.service_end_date ? addDaysKey(a.service_end_date, -1) : null,
        unitsLeft: null,
        approvedOn: a.authorization_approved_on,
        weeklyHoursTarget: a.worksheet_weekly_hours,
      })),
      ratios: mine
        .map((a) => parseRatio(a.service_code.trim().toUpperCase(), a.ratio))
        .filter((r): r is ClientRatioEntry => !!r),
      teamStaffIds: members.map((t) => t.staff_id),
      teamCodes: Object.fromEntries(members.map((t) => [t.staff_id, t.service_codes ?? []])),
      doNotScheduleStaffIds: excluded.map((e) => e.staff_user_id),
      doNotScheduleReasons: Object.fromEntries(excluded.map((e) => [e.staff_user_id, e.reason])),
    };
  }
  return out;
}

/** The scheduled_shifts columns toRuleShift reads; every caller that hands rows to the guard selects these. */
export const SHIFT_COLUMNS =
  "id, staff_id, client_id, team_id, service_code, starts_at, ends_at, parent_shift_id, status, van_route_id, shift_type";

/** Shifts already on the books for these staff and clients, from the Sunday before to the Saturday after. */
async function loadBooked(
  db: Db,
  orgId: string,
  shifts: readonly RuleShift[],
  staffIds: string[],
  clientIds: string[],
) {
  const days = shifts.map((s) => dayKey(s.startsAt)).sort();
  const { startIso } = toLocalRange(addDaysKey(weekStartKey(days[0]!), -1));
  const { endExclusiveIso } = toLocalRange(addDaysKey(weekStartKey(days[days.length - 1]!), 7));
  const base = () =>
    db
      .from("scheduled_shifts")
      .select(SHIFT_COLUMNS)
      .eq("organization_id", orgId)
      .neq("status", "cancelled")
      .gte("starts_at", startIso)
      .lt("starts_at", endExclusiveIso);
  const [byStaff, byClient] = await Promise.all([
    staffIds.length ? rows<ShiftRowIn>(base().in("staff_id", staffIds)) : [],
    clientIds.length ? rows<ShiftRowIn>(base().in("client_id", clientIds)) : [],
  ]);
  const seen = new Map<string, RuleShift>();
  for (const r of [...byStaff, ...byClient]) if (r.id) seen.set(r.id, toRuleShift(r, r.id));
  return [...seen.values()];
}

const SETTINGS_COLUMNS = "rule_settings, ot_threshold_hours, hours_cap, min_rest_hours, max_days_in_row, max_hours_in_row";
type AgencyRuleSettings = {
  rule_settings: Record<string, Strength> | null;
  ot_threshold_hours: number;
  hours_cap: number;
  min_rest_hours: number;
  max_days_in_row: number;
  max_hours_in_row: number;
};

export async function loadRuleContext(
  db: Db,
  orgId: string,
  shifts: readonly RuleShift[],
): Promise<RuleContext> {
  const staffIds = uniq(shifts.map((s) => s.staffId));
  const clientIds = uniq(shifts.map((s) => s.clientId));
  const teamIds = uniq(shifts.map((s) => s.teamId));
  const firstDay: Record<string, string> = {};
  for (const s of shifts) {
    const d = dayKey(s.startsAt);
    if (s.staffId && (!firstDay[s.staffId] || d < firstDay[s.staffId]!)) firstDay[s.staffId] = d;
  }
  const [clients, { staff, evidence, signedOffHomes }, booked, settings] = await Promise.all([
    loadClients(db, orgId, clientIds),
    loadStaff(db, orgId, staffIds, firstDay),
    shifts.length ? loadBooked(db, orgId, shifts, staffIds, clientIds) : [],
    db.from("org_shift_behavior_settings").select(SETTINGS_COLUMNS).eq("organization_id", orgId).maybeSingle(),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  const s = settings.data as AgencyRuleSettings | null;
  // Homes: each shift's own team, else its client's home.
  const homeIds = uniq([...teamIds, ...Object.values(clients).map((c) => c.homeId)]);
  const [teams, homeSettings] = homeIds.length
    ? await Promise.all([
        rows<{ id: string; team_name: string; capacity: number | null }>(
          db.from("teams").select("id, team_name, capacity").in("id", homeIds)),
        rows<{ team_id: string; rule_overrides: Record<string, Strength> | null }>(
          db.from("team_schedule_settings").select("team_id, rule_overrides").in("team_id", homeIds)),
      ])
    : [[], []];
  return {
    today: dayKey(new Date()),
    clients,
    staff,
    evidence,
    signedOffHomes,
    shifts: booked,
    places: Object.fromEntries(
      teams.map((t) => [t.id, { id: t.id, name: t.team_name, licensedCapacity: t.capacity }]),
    ),
    settings: {
      rules: s?.rule_settings ?? {},
      homeRules: Object.fromEntries(homeSettings.map((h) => [h.team_id, h.rule_overrides ?? {}])),
      ...(s ? {
        overtimeThresholdHours: Number(s.ot_threshold_hours),
        hoursCap: s.hours_cap,
        minRestHours: s.min_rest_hours,
        maxDaysInRow: s.max_days_in_row,
        maxHoursInRow: s.max_hours_in_row,
      } : {}),
    },
  };
}
