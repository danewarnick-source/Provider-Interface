// Services & billing: one client's authorizations (client_billing_codes, the
// 1056). Pure — the loader and server functions call these. An authorization
// is never deleted: "End" sets service_end_date, and a row whose end date is
// today or earlier is ended (same rule as codes.ts isActiveCodeRow).

import { isDailyServiceCode } from "../service-billing.ts";
import { parseLocalDate, todayYmd } from "./dates.ts";
import { codePace, type CodePace } from "./readiness.ts";

export type AuthorizationRow = {
  id: string;
  service_code: string;
  unit_type: string;
  rate_per_unit: number | null;
  annual_unit_authorization: number | null;
  monthly_max_units: number | null;
  service_start_date: string | null;
  service_end_date: string | null;
  authorization_number: string | null;
  authorization_approved_on: string | null;
  authorization_pending: boolean | null;
  rate_source: string | null;
};

export type AuthorizationState = "pending" | "upcoming" | "current" | "ended";

/** Stored unit types the editor offers. */
export const UNIT_TYPES = { Q: "15 minutes", day: "Day", hourly: "Hour" } as const;
export type UnitType = keyof typeof UNIT_TYPES;

const DAY_MS = 86_400_000;

export function authorizationState(
  row: Pick<AuthorizationRow, "service_start_date" | "service_end_date" | "authorization_pending">,
  today: string,
): AuthorizationState {
  const end = row.service_end_date?.slice(0, 10) ?? null;
  if (end && end <= today) return "ended";
  if (row.authorization_pending) return "pending";
  const start = row.service_start_date?.slice(0, 10) ?? null;
  if (start && start > today) return "upcoming";
  return "current";
}

export type Money = { authorized: number; used: number; left: number };

export type AuthorizationView = {
  row: AuthorizationRow;
  state: AuthorizationState;
  daily: boolean;
  /** "days" for daily-rate codes, otherwise "units". */
  unitWord: "days" | "units";
  pace: CodePace;
  /** Dollars at the row's rate; null when no rate is on file. */
  money: Money | null;
  /** Units per week that would use the rest by the end date; null when not meaningful. */
  perWeekToUseRest: number | null;
  /** Date the units run out at the pace so far, when that's before the end date. */
  runsOutOn: string | null;
};

function ymd(d: Date): string {
  return todayYmd(d);
}

/** The view of one authorization with `used` units (from units.ts usedUnitsForCode). */
export function authorizationView(row: AuthorizationRow, used: number, now: Date = new Date()): AuthorizationView {
  const today = todayYmd(now);
  const state = authorizationState(row, today);
  const daily = isDailyServiceCode(row.service_code);
  const pace = codePace(row, used, now);
  const rate = Number(row.rate_per_unit ?? 0);
  const money =
    rate > 0 && pace.annual > 0
      ? { authorized: pace.annual * rate, used: Math.min(used, pace.annual) * rate, left: pace.left * rate }
      : null;

  let perWeekToUseRest: number | null = null;
  let runsOutOn: string | null = null;
  const start = parseLocalDate(row.service_start_date);
  const end = parseLocalDate(pace.end);
  const todayDate = parseLocalDate(today);
  if (state === "current" && pace.annual > 0 && end && todayDate) {
    const daysLeft = (end.getTime() - todayDate.getTime()) / DAY_MS + 1;
    if (daysLeft > 0) perWeekToUseRest = (pace.left / daysLeft) * 7;
    if (start && used > 0 && pace.left > 0) {
      const daysGone = (todayDate.getTime() - start.getTime()) / DAY_MS + 1;
      if (daysGone > 0) {
        const perDay = used / daysGone;
        const out = new Date(todayDate.getTime() + Math.ceil(pace.left / perDay) * DAY_MS);
        if (out < end) runsOutOn = ymd(out);
      }
    } else if (pace.left === 0) {
      runsOutOn = today;
    }
  }
  return { row, state, daily, unitWord: daily ? "days" : "units", pace, money, perWeekToUseRest, runsOutOn };
}

/** Dollar totals over authorizations that aren't ended and have a rate. */
export function servicesTotals(views: readonly AuthorizationView[]): Money {
  const t: Money = { authorized: 0, used: 0, left: 0 };
  for (const v of views) {
    if (v.state === "ended" || !v.money) continue;
    t.authorized += v.money.authorized;
    t.used += v.money.used;
    t.left += v.money.left;
  }
  return t;
}

/** Ended authorizations last; within a group, by code then newest start. */
export function sortAuthorizations(views: AuthorizationView[]): AuthorizationView[] {
  return [...views].sort((a, b) => {
    const ea = a.state === "ended" ? 1 : 0;
    const eb = b.state === "ended" ? 1 : 0;
    if (ea !== eb) return ea - eb;
    const c = a.row.service_code.localeCompare(b.row.service_code);
    if (c !== 0) return c;
    return (b.row.service_start_date ?? "").localeCompare(a.row.service_start_date ?? "");
  });
}

// ─── Validation (the editor, End and Fill from 1056 all use these) ──────────

export type AuthorizationInput = {
  code: string;
  unitType: string;
  rate: number | null;
  annualUnits: number | null;
  monthlyMaxUnits?: number | null;
  start: string | null;
  end: string | null;
  authorizationNumber?: string | null;
  approvedOn?: string | null;
};

/** A real calendar date written YYYY-MM-DD. */
export function isYmd(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseLocalDate(value);
  return !!d && ymd(d) === value;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Problems that stop a save, in plain English. `agencyCodes` empty = not checked. */
export function authorizationProblems(input: AuthorizationInput, agencyCodes: readonly string[]): string[] {
  const out: string[] = [];
  const code = normalizeCode(input.code);
  const label = code || "This line";
  if (!/^[A-Z0-9]{2,4}$/.test(code)) out.push(`${label}: enter the service code (2–4 letters).`);
  else if (agencyCodes.length && !agencyCodes.map(normalizeCode).includes(code))
    out.push(`${code} isn't one of your agency's approved codes.`);
  if (!(input.unitType in UNIT_TYPES)) out.push(`${label}: pick a unit type.`);
  else if (code && isDailyServiceCode(code) !== (input.unitType === "day"))
    out.push(`${label}: ${isDailyServiceCode(code) ? "is billed by the day" : "isn't a daily code"} — check the unit type.`);
  if (input.rate == null || !Number.isFinite(input.rate) || input.rate < 0)
    out.push(`${label}: enter the rate (0 or more).`);
  if (input.annualUnits == null || !Number.isInteger(input.annualUnits) || input.annualUnits < 0)
    out.push(`${label}: units per year must be a whole number.`);
  if (input.monthlyMaxUnits != null && (!Number.isInteger(input.monthlyMaxUnits) || input.monthlyMaxUnits < 0))
    out.push(`${label}: units per month must be a whole number.`);
  if (!isYmd(input.start)) out.push(`${label}: enter a real start date.`);
  if (!isYmd(input.end)) out.push(`${label}: enter a real end date.`);
  else if (isYmd(input.start) && input.end <= input.start) out.push(`${label}: the end date must be after the start date.`);
  if (input.approvedOn && !isYmd(input.approvedOn)) out.push(`${label}: the 1056 approved date isn't a real date.`);
  if ((input.authorizationNumber ?? "").length > 40) out.push(`${label}: the 1056 number is too long.`);
  return out;
}

/** Problems with ending an authorization on `endOn`. */
export function endProblems(row: Pick<AuthorizationRow, "service_start_date" | "service_end_date">, endOn: string): string[] {
  if (!isYmd(endOn)) return ["Pick a real end date."];
  const start = row.service_start_date?.slice(0, 10);
  if (start && endOn < start) return ["The end date can't be before the start date."];
  return [];
}

/** client_billing_codes values for a validated input (scoping columns are added by the server). */
export function authorizationValues(input: AuthorizationInput): Record<string, unknown> {
  return {
    service_code: normalizeCode(input.code),
    unit_type: input.unitType,
    rate_per_unit: input.rate ?? 0,
    annual_unit_authorization: input.annualUnits ?? 0,
    monthly_max_units: input.monthlyMaxUnits ?? null,
    service_start_date: input.start,
    service_end_date: input.end,
    authorization_number: input.authorizationNumber?.trim() || null,
    authorization_approved_on: input.approvedOn || null,
    authorization_pending: false,
  };
}
