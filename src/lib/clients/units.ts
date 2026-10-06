// Units used against one authorization (client_billing_codes row) inside its
// own service window. One path for the profile budget and the client list.
// Quarter-hour codes: per-entry units via computeEntryUnits, summed (never a
// rounded total). Daily codes: distinct billable days. RHS/DSG: a date counts
// when any staff clocked a complete shift with a real note that day.

import {
  computeEntryUnits,
  effectiveBillingTimes,
  isBillableForReview,
  remainingUnitsForCode,
} from "../billing-units.ts";
import { isNonAnswer } from "../nectar-quality.ts";
import { isDailyServiceCode } from "../service-billing.ts";
import { parseLocalDate } from "./dates.ts";

export type UsageTimesheet = {
  client_id?: string | null;
  service_type_code: string | null;
  clock_in_timestamp: string | null;
  clock_out_timestamp: string | null;
  rounded_clock_in: string | null;
  rounded_clock_out: string | null;
  corrected_clock_in: string | null;
  corrected_clock_out: string | null;
  review_status: string | null;
  shift_note_text?: string | null;
};

/** Billable daily rows from hhs_daily_records_v. */
export type UsageDay = {
  client_id?: string | null;
  record_date: string | null;
  service_code: string | null;
};

export type UsageCode = {
  service_code: string;
  service_start_date: string | null;
  service_end_date: string | null;
  annual_unit_authorization: number | null;
};

export type CodeUsage = { usedUnits: number; usedHours: number; usedDays: number };

function residentialDays(
  code: string,
  start: Date,
  end: Date | null,
  rows: readonly UsageTimesheet[],
): number {
  const dates = new Set<string>();
  for (const r of rows) {
    if (r.service_type_code !== code || !isBillableForReview(r)) continue;
    const approved = r.review_status === "approved";
    const billIn =
      approved && r.corrected_clock_in
        ? r.corrected_clock_in
        : (r.rounded_clock_in ?? r.clock_in_timestamp);
    const billOut =
      approved && r.corrected_clock_out
        ? r.corrected_clock_out
        : (r.rounded_clock_out ?? r.clock_out_timestamp);
    if (!billIn || !billOut) continue;
    const inT = new Date(billIn);
    if (inT < start || (end && inT > end)) continue;
    const note = r.shift_note_text ?? "";
    const qualifies =
      code === "RHS"
        ? !isNonAnswer(note) && note.trim().length >= 50
        : !isNonAnswer(note) && note.trim().length > 0;
    if (qualifies) dates.add(billIn.slice(0, 10));
  }
  return dates.size;
}

function dailyDays(code: string, start: Date, end: Date | null, rows: readonly UsageDay[]): number {
  const dates = new Set<string>();
  for (const r of rows) {
    if (!r.record_date) continue;
    if (r.service_code && r.service_code !== code) continue;
    const d = parseLocalDate(r.record_date);
    if (!d || d < start || (end && d > end)) continue;
    dates.add(r.record_date);
  }
  return dates.size;
}

/** Units used for one code between its start and end date. Rows must already be this client's. */
export function usedUnitsForCode(
  code: UsageCode,
  timesheets: readonly UsageTimesheet[],
  days: readonly UsageDay[],
): CodeUsage {
  const start = parseLocalDate(code.service_start_date);
  if (!start) return { usedUnits: 0, usedHours: 0, usedDays: 0 };
  const end = parseLocalDate(code.service_end_date);
  const sc = code.service_code;
  if (sc === "RHS" || sc === "DSG") {
    const n = residentialDays(sc, start, end, timesheets);
    return { usedUnits: n, usedHours: 0, usedDays: n };
  }
  if (isDailyServiceCode(sc)) {
    const n = dailyDays(sc, start, end, days);
    return { usedUnits: n, usedHours: 0, usedDays: n };
  }
  let usedHours = 0;
  let usedUnits = 0;
  for (const r of timesheets) {
    if (r.service_type_code !== sc) continue;
    const t = effectiveBillingTimes(r);
    if (!t) continue;
    const inT = new Date(t.in);
    if (inT < start || (end && inT > end)) continue;
    const hrs = (new Date(t.out).getTime() - inT.getTime()) / 3_600_000;
    if (hrs > 0 && Number.isFinite(hrs)) {
      usedHours += hrs;
      usedUnits += computeEntryUnits(t.in, t.out);
    }
  }
  return { usedUnits, usedHours, usedDays: 0 };
}

export type UnitsLeft = { code: string; left: number; annual: number; pct: number };

/**
 * The code closest to running out (lowest share of its authorization left).
 * Codes without units on file or still waiting on the 1056 are skipped.
 */
export function worstUnitsLeft(
  codes: readonly (UsageCode & { authorization_pending?: boolean | null })[],
  timesheets: readonly UsageTimesheet[],
  days: readonly UsageDay[],
): UnitsLeft | null {
  let worst: UnitsLeft | null = null;
  for (const c of codes) {
    const annual = c.annual_unit_authorization ?? 0;
    if (c.authorization_pending || annual <= 0) continue;
    const used = usedUnitsForCode(c, timesheets, days).usedUnits;
    const left = remainingUnitsForCode(annual, used);
    const pct = (left / annual) * 100;
    if (!worst || pct < worst.pct) worst = { code: c.service_code, left, annual, pct };
  }
  return worst;
}
