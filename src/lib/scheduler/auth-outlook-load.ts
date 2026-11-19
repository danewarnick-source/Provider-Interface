// The 1056 outlook's reads (the board's Clients view panel and Needs you's
// 1056 rows): active client_billing_codes rows, clock-ins (evv_timesheets) and
// billable host-home days (hhs_daily_records_v) since the plan year began, and
// the next 4 weeks of shifts; the math is auth-outlook.ts. "Used" counts up to
// the start of this week; this week counts from the schedule. Takes the
// database client so the board (browser) and needs.server.ts (the caller's
// server client) share it; RLS applies either way.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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
import { codeActiveOn } from "@/lib/scheduler/board-model";
import { addDaysKey, dayKey, parseLocalDate } from "@/lib/scheduler/time";

type Db = SupabaseClient<Database>;

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

async function punchesSince(
  supabase: Db,
  orgId: string,
  fromIso: string,
  toIso: string,
): Promise<Punch[]> {
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

export async function loadAuthOutlook(
  supabase: Db,
  orgId: string,
  weekStart: string,
): Promise<OutlookRow[]> {
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
    punchesSince(supabase, org, fromIso, weekStartIso),
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
