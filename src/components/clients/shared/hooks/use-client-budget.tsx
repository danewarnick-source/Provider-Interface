import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "../../../../hooks/use-org";
import { useAllClientBillingCodes, type ClientBillingCode } from "./use-client-billing-codes";
import { remainingUnitsForCode, unitsToHours, UNITS_PER_HOUR } from "@/lib/billing-units";
import { isDailyServiceCode } from "@/lib/service-billing";
import { isRouteUuid } from "@/lib/route-uuid";
import { parseLocalDate } from "@/lib/clients/dates";
import { usedUnitsForCode, type UsageDay, type UsageTimesheet } from "@/lib/clients/units";

/**
 * Live per-code budget ledger. For each authorized billing code we
 * compute used units (across ALL staff) within the code's annual budget
 * window, plus the renewal target and a hours/week-needed projection.
 *
 * Hourly codes: used = hours × 4. Daily codes: used = distinct days.
 */
export type CodeBudget = {
  code: ClientBillingCode;
  /** Start of the budget year for this code (defaults to today if unset). */
  period_start: Date;
  /** End/renewal date for this code (null if unset). */
  period_end: Date | null;
  is_daily: boolean;
  used_units: number;
  used_hours: number;
  remaining_units: number;
  remaining_hours: number;
  /** Pct of annual authorization used (0..200). */
  used_pct: number;
  /** Hours used per week so far (avg over weeks elapsed in window). */
  weekly_pace_hours: number;
  /** Hours/week needed to fully utilize remaining by renewal date. */
  hours_per_week_target: number;
  /** Days from today to renewal. Negative if passed. */
  days_to_renewal: number;
  /** Weeks from today to renewal. */
  weeks_to_renewal: number;
  status: "ok" | "under" | "over" | "exhausted" | "expired" | "no_period";
};

function parseDate(s: string | null | undefined): Date | null {
  return parseLocalDate(s);
}

function weeksBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / (7 * 86_400_000));
}

export function useClientBudget(clientId: string | undefined) {
  const { data: org } = useCurrentOrg();
  const { data: allCodes } = useAllClientBillingCodes();

  return useQuery({
    enabled: !!org?.organization_id && isRouteUuid(clientId) && !!allCodes,
    queryKey: ["client-budget", org?.organization_id, clientId, allCodes?.length],
    refetchInterval: 60_000,
    queryFn: async (): Promise<CodeBudget[]> => {
      const codes = (allCodes ?? []).filter(
        (c) => c.client_id === clientId && String(c.service_code ?? "").trim(),
      );
      if (codes.length === 0) return [];

      // Earliest real service_start_date gates the fetch. Do not invent Jan 1.
      const now = new Date();
      const earliestStart = codes
        .map((c) => parseDate(c.service_start_date))
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

      // Pull all completed punches for this client in the widest window.
      let tsQ = supabase
        .from("evv_timesheets")
        .select("service_type_code, clock_in_timestamp, clock_out_timestamp, rounded_clock_in, rounded_clock_out, corrected_clock_in, corrected_clock_out, review_status, shift_note_text")
        .eq("organization_id", org!.organization_id)
        .eq("client_id", clientId!);
      if (earliestStart) tsQ = tsQ.gte("clock_in_timestamp", earliestStart.toISOString());
      const { data: tsRows, error: tsErr } = await tsQ;
      if (tsErr) throw tsErr;

      // Daily-rate days come from the hhs_daily_records_v view; only
      // billable rows (attendance Present + daily note) consume budget.
      let dlQ = supabase
        .from("hhs_daily_records_v")
        .select("record_date, service_code, billable")
        .eq("organization_id", org!.organization_id)
        .eq("client_id", clientId!)
        .eq("billable", true);
      if (earliestStart) dlQ = dlQ.gte("record_date", earliestStart.toISOString().slice(0, 10));
      const { data: dlRows, error: dlErr } = await dlQ;
      if (dlErr) throw dlErr;

      return codes.map((code): CodeBudget => {
        const period_start = parseDate(code.service_start_date);
        const period_end = parseDate(code.service_end_date);
        const is_daily = isDailyServiceCode(code.service_code);

        if (!period_start) {
          return {
            code,
            period_start: now,
            period_end,
            is_daily,
            used_units: 0,
            used_hours: 0,
            remaining_units: remainingUnitsForCode(code.annual_unit_authorization ?? 0, 0),
            remaining_hours: 0,
            used_pct: 0,
            weekly_pace_hours: 0,
            hours_per_week_target: 0,
            days_to_renewal: 0,
            weeks_to_renewal: 0,
            status: "no_period" as const,
          };
        }

        const usage = usedUnitsForCode(
          { ...code, service_code: String(code.service_code) },
          (tsRows ?? []) as UsageTimesheet[],
          (dlRows ?? []) as UsageDay[],
        );
        const used_days = usage.usedDays;
        const used_hours = usage.usedHours;
        const used_units = usage.usedUnits;
        const annual = code.annual_unit_authorization ?? 0;
        const remaining_units = remainingUnitsForCode(annual, used_units);
        const remaining_hours = is_daily
          ? remaining_units // for daily, "hours" col is irrelevant; mirror days
          : unitsToHours(remaining_units);
        const used_pct = annual > 0 ? Math.min(200, (used_units / annual) * 100) : 0;

        const weeksElapsed = Math.max(0.001, weeksBetween(period_start, now));
        const weekly_pace_hours = is_daily ? used_days / weeksElapsed : used_hours / weeksElapsed;

        const days_to_renewal = period_end
          ? Math.ceil((period_end.getTime() - now.getTime()) / 86_400_000)
          : 0;
        const weeks_to_renewal = period_end ? weeksBetween(now, period_end) : 0;

        let hours_per_week_target = 0;
        let status: CodeBudget["status"] = "ok";
        if (!period_end) {
          status = "no_period";
        } else if (days_to_renewal < 0) {
          status = "expired";
        } else if (used_units >= annual && annual > 0) {
          status = "exhausted";
        } else if (weeks_to_renewal > 0) {
          hours_per_week_target = is_daily
            ? remaining_units / weeks_to_renewal
            : remaining_hours / weeks_to_renewal;
          if (weekly_pace_hours > hours_per_week_target * 1.15) status = "over";
          else if (weekly_pace_hours < hours_per_week_target * 0.7) status = "under";
        }

        return {
          code,
          period_start,
          period_end,
          is_daily,
          used_units,
          used_hours: is_daily ? used_days : used_hours,
          remaining_units,
          remaining_hours,
          used_pct,
          weekly_pace_hours,
          hours_per_week_target,
          days_to_renewal,
          weeks_to_renewal,
          status,
        };
      });
    },
  });
}

export const _UNITS_PER_HOUR = UNITS_PER_HOUR;
