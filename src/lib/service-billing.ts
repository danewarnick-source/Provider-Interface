import { DAILY_MODE_CODES, DAILY_UNIT_CODES } from "./scheduler/billing-mode.ts";

// Single source of truth for which service codes bill by the day vs. by
// the hour. Hourly codes accrue in quarter-hour units from time punches
// (see billing-units.ts). Daily codes pay once per completed
// attendance/daily-log day.
//
// The list comes from src/lib/scheduler/billing-mode.ts (the rate table). It
// holds the codes whose own unit is the day (HHS, RHS, PPS, DSG, RP4, RP5, SED,
// PN1) plus MTP (flat daily). Codes that are hourly but flip to a daily rate
// (COM, PAC, RP2, RP3, EPR, PN2, and the DSI/SEE tiers) stay hourly here so
// time accrual keeps counting their hours; ask hasDailyMode() for those, and
// billingFor() in billing-mode.ts for the unit on a given day.
// NOTE: DSP is mode-dependent (qtr-hr OR daily) — handled in
// src/lib/scheduler/day-program.ts, NOT here.
export const DAILY_SERVICE_CODES: ReadonlySet<string> = new Set(DAILY_UNIT_CODES);

const DAILY_MODE_SET: ReadonlySet<string> = new Set(DAILY_MODE_CODES);

/** True for any code that can bill a daily rate in some mode (threshold, tier or by authorization). */
export function hasDailyMode(code: string | null | undefined): boolean {
  return !!code && DAILY_MODE_SET.has(code.toUpperCase());
}

export function isDailyServiceCode(code: string | null | undefined): boolean {
  return !!code && DAILY_SERVICE_CODES.has(code);
}

export function isHourlyServiceCode(code: string | null | undefined): boolean {
  return !!code && !DAILY_SERVICE_CODES.has(code);
}

export function billingUnitLabel(code: string | null | undefined): "Hourly" | "Daily" {
  return isDailyServiceCode(code) ? "Daily" : "Hourly";
}

// Short letter code for a stored client_billing_codes.unit_type value, for
// display only — never write the letter back as the stored value except via
// the canonical UNIT_TYPE_OPTIONS values below. Tolerant of the historical
// variants that exist across write paths ("unit", "Q", "day", "daily", "15min").
export type UnitTypeLetter = "Q" | "D" | "H";

export const UNIT_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string; letter: UnitTypeLetter }> = [
  { value: "Q", label: "Quarter-hour (15 min)", letter: "Q" },
  { value: "day", label: "Daily", letter: "D" },
  { value: "hourly", label: "Hourly", letter: "H" },
];

export function unitTypeLetter(
  unitType: string | null | undefined,
  code?: string | null,
): UnitTypeLetter {
  const v = (unitType ?? "").trim().toLowerCase();
  if (["day", "daily", "d"].includes(v)) return "D";
  if (["hour", "hourly", "h"].includes(v)) return "H";
  if (["unit", "q", "15min", "15 min", "quarter", "quarter-hour", "quarter_hour"].includes(v)) return "Q";
  if (code) return isDailyServiceCode(code) ? "D" : "Q";
  return "Q";
}

// Codes that staff CAN clock in on for payroll/evidence capture even though
// they may also have a daily-rate component (e.g. RHS — residential staff
// clock for payroll even though the client billing is daily; DSG/RP4/
// RP5/SED similarly capture time for payroll). Excluded from staff
// clock-in: HHS (host home) and PPS (professional parent supports) — no
// agency clock component; and MTP — transport-only, logged on the day-
// program transport block, never a labor punch.
const NON_CLOCKABLE_CODES: ReadonlySet<string> = new Set(["HHS", "PPS", "MTP"]);

export function isClockableServiceCode(code: string | null | undefined): boolean {
  return !!code && !NON_CLOCKABLE_CODES.has(code);
}

