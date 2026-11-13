// Reads for the scheduler board (components/scheduler/board/), run as the
// signed-in user (RLS applies). loadBoardData: clients, homes (teams), active
// team members (organization_members, then profiles: two queries joined here,
// never an embed), shifts in range, each client's 1056 codes, caseloads, time
// off, shift types (B2 Settings) and the overtime threshold. loadAuthOutlook:
// the Clients view's 1056 panel: active client_billing_codes rows, clock-ins
// (evv_timesheets) and billable host-home days (hhs_daily_records_v) since the
// plan year began, and the next 4 weeks of shifts; the math is auth-outlook.ts.
// "Used" counts up to the start of this week; this week counts from the schedule.
import { supabase } from "@/integrations/supabase/client";
import { isBillableForReview } from "@/lib/billing-units";
import {
  authOutlook,
  inDisplayUnits,
  isDailyCode,
  planYearOf,
  usageUnits,
  type Entry,
  type Outlook,
} from "@/lib/scheduler/auth-outlook";
import {
  codeActiveOn,
  type BoardClient,
  type BoardShift,
  type BoardTeam,
} from "@/lib/scheduler/board-model";
import { addDaysKey, dayKey, parseLocalDate } from "@/lib/scheduler/time";

export type BoardStaff = { id: string; name: string };
export type BoardCode = {
  client_id: string;
  service_code: string;
  service_start_date: string | null;
  service_end_date: string | null;
};
export type BoardTimeOff = {
  staff_id: string;
  start_date: string;
  end_date: string;
  status: string;
};
export type BoardShiftType = {
  key: string | null;
  name: string;
  start_time: string;
  end_time: string;
  used_at: string[];
};
export type BoardAssign = { staff_id: string; client_id: string };

export type BoardData = {
  clients: BoardClient[];
  teams: BoardTeam[];
  staff: BoardStaff[];
  shifts: BoardShift[];
  codes: BoardCode[];
  assigns: BoardAssign[];
  timeOff: BoardTimeOff[];
  shiftTypes: BoardShiftType[];
  otHours: number;
};

const SHIFT_SELECT =
  "id, staff_id, client_id, team_id, service_code, starts_at, ends_at, status, published, parent_shift_id, open_spots, override_reason, shift_type, notes, claim_requested_by";

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

const nameOf = (p: {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}) =>
  (p.full_name ?? "").trim() ||
  [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
  "Team member";

export type BoardRange = { startIso: string; endIso: string; from: string; to: string };

export async function loadBoardData(orgId: string, range: BoardRange): Promise<BoardData> {
  const org = orgId;
  const [clients, teams, members, shifts, codes, assigns, timeOff, types, settings] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, first_name, last_name, team_id")
        .eq("organization_id", org)
        .is("deleted_at", null),
      supabase
        .from("teams")
        .select("id, team_name, team_type")
        .eq("organization_id", org)
        .eq("active", true)
        .order("team_name"),
      supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", org)
        .eq("active", true)
        .is("deleted_at", null),
      supabase
        .from("scheduled_shifts")
        .select(SHIFT_SELECT)
        .eq("organization_id", org)
        .gte("starts_at", range.startIso)
        .lt("starts_at", range.endIso)
        .order("starts_at"),
      supabase
        .from("client_billing_codes")
        .select("client_id, service_code, service_start_date, service_end_date")
        .eq("organization_id", org),
      supabase.from("staff_assignments").select("staff_id, client_id").eq("organization_id", org),
      supabase
        .from("time_off_requests")
        .select("staff_id, start_date, end_date, status")
        .eq("organization_id", org)
        .in("status", ["approved", "pending"])
        .lte("start_date", range.to)
        .gte("end_date", range.from),
      supabase
        .from("shift_types")
        .select("key, name, start_time, end_time, used_at")
        .eq("organization_id", org)
        .is("archived_at", null)
        .order("start_time"),
      supabase
        .from("org_shift_behavior_settings")
        .select("ot_threshold_hours")
        .eq("organization_id", org)
        .maybeSingle(),
    ]);
  const ids = [
    ...new Set(
      must(members)
        .map((m) => m.user_id)
        .filter((x): x is string => !!x),
    ),
  ];
  const profiles = ids.length
    ? must(
        await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name")
          .in("id", ids),
      )
    : [];
  return {
    clients: must(clients),
    teams: must(teams),
    staff: profiles
      .map((p) => ({ id: p.id, name: nameOf(p) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    shifts: must(shifts) as BoardShift[],
    codes: must(codes),
    assigns: must(assigns),
    timeOff: must(timeOff),
    shiftTypes: must(types),
    otHours: Number(settings.data?.ot_threshold_hours ?? 40),
  };
}

export type OutlookRow = {
  clientId: string;
  code: string;
  unit: "h" | "days";
  authorized: number;
  /** Authorized in billing units (quarter hours), for the "(N units)" hint. */
  authorizedUnits: number;
  standardWeek: number;
  planEnd: string;
  outlook: Outlook;
};

const HOST_HOME = new Set(["HHS", "PPS"]);

type Punch = {
  client_id: string;
  service_type_code: string;
  clock_in_timestamp: string;
  clock_out_timestamp: string | null;
  review_status: string | null;
};

async function punchesSince(orgId: string, fromIso: string, toIso: string): Promise<Punch[]> {
  const out: Punch[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("evv_timesheets")
      .select(
        "client_id, service_type_code, clock_in_timestamp, clock_out_timestamp, review_status",
      )
      .eq("organization_id", orgId)
      .gte("clock_in_timestamp", fromIso)
      .lt("clock_in_timestamp", toIso)
      .order("clock_in_timestamp")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function loadAuthOutlook(orgId: string, weekStart: string): Promise<OutlookRow[]> {
  const org = orgId;
  const today = dayKey(new Date());
  const weekStartIso = parseLocalDate(weekStart).toISOString();
  const { data: codeRows, error } = await supabase
    .from("client_billing_codes")
    .select(
      "client_id, service_code, annual_unit_authorization, service_start_date, service_end_date",
    )
    .eq("organization_id", org);
  if (error) throw new Error(error.message);
  const codes = (codeRows ?? [])
    .filter((c) => c.annual_unit_authorization > 0 && codeActiveOn(c, today))
    .map((c) => ({
      ...c,
      code: c.service_code.toUpperCase(),
      plan: planYearOf(c.service_start_date, c.service_end_date),
    }))
    .filter((c): c is typeof c & { plan: { start: string; end: string } } => !!c.plan);
  if (!codes.length) return [];
  const earliest = codes.map((c) => c.plan.start).sort()[0]!;
  const fromIso = parseLocalDate(earliest).toISOString();
  const [punches, days, shifts] = await Promise.all([
    punchesSince(org, fromIso, weekStartIso),
    supabase
      .from("hhs_daily_records_v")
      .select("client_id, record_date")
      .eq("organization_id", org)
      .eq("billable", true)
      .gte("record_date", earliest)
      .lt("record_date", weekStart),
    supabase
      .from("scheduled_shifts")
      .select("client_id, service_code, starts_at, ends_at")
      .eq("organization_id", org)
      .neq("status", "cancelled")
      .not("client_id", "is", null)
      .gte("starts_at", weekStartIso)
      .lt("starts_at", parseLocalDate(addDaysKey(weekStart, 28)).toISOString()),
  ]);
  if (days.error) throw new Error(days.error.message);
  if (shifts.error) throw new Error(shifts.error.message);
  const weekEnd = addDaysKey(weekStart, 6);
  return codes.map((c): OutlookRow => {
    const inPlan = (ymd: string) => ymd >= c.plan.start;
    const scheduled: Entry[] = (shifts.data ?? [])
      .filter((s) => s.client_id === c.client_id && (s.service_code ?? "").toUpperCase() === c.code)
      .map((s) => ({ start: s.starts_at, end: s.ends_at }));
    const thisWeek = scheduled.filter((e) => dayKey(e.start) <= weekEnd);
    const usedBefore = HOST_HOME.has(c.code)
      ? (days.data ?? []).filter(
          (d) => d.client_id === c.client_id && d.record_date && inPlan(d.record_date),
        ).length
      : usageUnits(
          c.code,
          punches
            .filter(
              (p) => p.client_id === c.client_id && p.service_type_code.toUpperCase() === c.code,
            )
            .filter((p) => isBillableForReview(p) && inPlan(dayKey(p.clock_in_timestamp)))
            .map((p) => ({ start: p.clock_in_timestamp, end: p.clock_out_timestamp })),
        );
    const standardUnits = HOST_HOME.has(c.code) ? 7 : usageUnits(c.code, scheduled) / 4;
    const disp = (n: number) => inDisplayUnits(c.code, n);
    return {
      clientId: c.client_id,
      code: c.code,
      unit: isDailyCode(c.code) ? "days" : "h",
      authorized: disp(c.annual_unit_authorization),
      authorizedUnits: c.annual_unit_authorization,
      standardWeek: disp(standardUnits),
      planEnd: c.plan.end,
      outlook: authOutlook({
        authorized: disp(c.annual_unit_authorization),
        usedBefore: disp(usedBefore),
        scheduledThisWeek: disp(HOST_HOME.has(c.code) ? 0 : usageUnits(c.code, thisWeek)),
        standardWeek: disp(standardUnits),
        weekEnd,
        planEnd: c.plan.end,
      }),
    };
  });
}
