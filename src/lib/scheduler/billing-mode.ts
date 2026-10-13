// How every DHHS91172 service code bills: its unit, its modes, and the day-level
// thresholds that flip an hourly code to a daily rate. Pure. Billing and the
// burn-down read this; nothing else decides units.
//
// Quarter-hour rule (CLAUDE.md): each ENTRY rounds to the nearest quarter hour
// (Math.round of minutes / 15) and units are summed per entry, never rounded
// on a summed total. Raw timestamps are never altered.
//
// The "day" is the Denver calendar day the entries start on (the caller groups
// entries by that day and passes the day's entries here).

export type UnitMode = "quarter_hour" | "daily" | "daily_tier" | "session" | "monthly" | "milestone" | "flat";

export type BillingSpec = {
  /** Unit the code bills in when nothing flips it. */
  unit: UnitMode;
  /** Also has a daily-rate mode (threshold, tiers, or chosen by the authorization). */
  dailyMode: boolean;
  /** Daily rate applies once the day's minutes are MORE THAN this (COM, PAC). */
  dailyOverMinutes?: number;
  /** Daily rate applies once the day's minutes reach AT LEAST this (RP2, RP3). */
  dailyAtLeastMinutes?: number;
  /** Tiered daily rates, one per whole hour, 1..N (DSI, SEE: rate-table note 2). */
  maxTierHours?: number;
  /** Section of DHHS91172 (or the rate table) that sets the mode. */
  cite: string;
};

const QH = (cite: string, extra: Partial<BillingSpec> = {}): BillingSpec => ({
  unit: "quarter_hour", dailyMode: false, cite, ...extra,
});
const DAY = (cite: string): BillingSpec => ({ unit: "daily", dailyMode: true, cite });

export const BILLING_MODES: Readonly<Record<string, BillingSpec>> = {
  // Residential / host homes / professional parent
  RHS: DAY("§21 rate table"),
  HHS: DAY("§11 rate table"),
  PPS: DAY("§20 rate table"),
  ELS: QH("§10 rate table"),
  // Supported living
  SLH: QH("§31 rate table"),
  SLN: QH("§32 rate table"),
  CMP: QH("§32 rate table"),
  CMS: QH("§32 rate table"),
  // Community / personal assistance / homemaker
  COM: QH("§6.6", { dailyMode: true, dailyOverMinutes: 6 * 60 }),
  PAC: QH("§14.5", { dailyMode: true, dailyOverMinutes: 8 * 60 }),
  HSQ: QH("§12 rate table"),
  // Day supports
  DSG: DAY("§7 rate table"),
  DSP: QH("§7.6", { dailyMode: true }), // quarter-hour or extended daily: chosen in S10
  DSI: { unit: "daily_tier", dailyMode: true, maxTierHours: 6, cite: "§8 rate-table note 2" },
  EPR: QH("§9 rate table", { dailyMode: true }),
  MTP: { unit: "flat", dailyMode: true, cite: "§13 rate table" },
  // Respite
  RP2: QH("§22.6", { dailyMode: true, dailyAtLeastMinutes: 6 * 60 }),
  RP3: QH("§23.6", { dailyMode: true, dailyAtLeastMinutes: 6 * 60 }),
  RP4: DAY("§24 rate table"),
  RP5: DAY("§25 rate table"),
  RPS: { unit: "session", dailyMode: false, cite: "§26 rate table" },
  // Supported employment
  SEI: QH("§30 rate table"),
  SEC: QH("§27 rate table"),
  SED: DAY("§28 rate table"),
  SEE: { unit: "daily_tier", dailyMode: true, maxTierHours: 6, cite: "§29 rate-table note 2" },
  SJD: QH("§33 rate table"),
  SJP: { unit: "milestone", dailyMode: false, cite: "§34 rate table" },
  SJR: { unit: "milestone", dailyMode: false, cite: "§35 rate table" },
  // Nursing
  PM1: QH("§16 rate table"),
  PM2: QH("§17 rate table"),
  PN1: DAY("§18 rate table"),
  PN2: QH("§19 rate table", { dailyMode: true }),
  // Behavior, budget, training
  BC1: QH("§3 rate table"),
  BC2: QH("§3 rate table"),
  BC3: QH("§3 rate table"),
  PBA: { unit: "monthly", dailyMode: false, cite: "§15 rate table" },
  TFB: QH("§36 rate table"),
};

export function billingSpec(code: string | null | undefined): BillingSpec | null {
  return (code && BILLING_MODES[code.toUpperCase()]) || null;
}

/** Codes whose own unit is the day (drives service-billing's daily list). */
export const DAILY_UNIT_CODES: ReadonlyArray<string> = Object.entries(BILLING_MODES)
  .filter(([, s]) => s.unit === "daily" || s.unit === "flat")
  .map(([c]) => c);

/** Codes that have a daily mode of any kind (threshold, tier, or by authorization). */
export const DAILY_MODE_CODES: ReadonlyArray<string> = Object.entries(BILLING_MODES)
  .filter(([, s]) => s.dailyMode)
  .map(([c]) => c);

export type Billed = {
  code: string;
  day: string;
  /** What the units are: 15-minute units, whole days, or a 1..6 hour tier. */
  unitType: "quarter_hour" | "day" | "tier" | "session" | "month" | "milestone";
  units: number;
  /** Hour tier for DSI/SEE (1..6), else null. */
  tier: number | null;
  /** Why the mode was picked (plain, for the billing screen). */
  reason: string;
};

/** Units for ONE entry: nearest quarter hour. */
export function entryQuarterHours(minutes: number): number {
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes / 15) : 0;
}

/**
 * Billing for one code on one day. `entryMinutes` is the length of each entry
 * (or one number for a single entry). Option `dailyRate` forces the daily mode
 * for codes where the authorization decides (DSP, EPR, PN2); DSG/DSP code
 * picking stays in S10.
 */
export function billingFor(
  code: string,
  entryMinutes: number | readonly number[],
  day: string,
  opts: { dailyRate?: boolean } = {},
): Billed {
  const c = code.toUpperCase();
  const spec = BILLING_MODES[c];
  const list = (typeof entryMinutes === "number" ? [entryMinutes] : [...entryMinutes]).filter(
    (m) => Number.isFinite(m) && m > 0,
  );
  const total = list.reduce((a, b) => a + b, 0);
  const out = (unitType: Billed["unitType"], units: number, reason: string, tier: number | null = null): Billed =>
    ({ code: c, day, unitType, units, tier, reason });

  if (!spec) return out("quarter_hour", list.reduce((a, m) => a + entryQuarterHours(m), 0), "Code not in the rate table; quarter hours.");
  if (total <= 0) return out(spec.unit === "daily" ? "day" : "quarter_hour", 0, "No time on this day.");

  switch (spec.unit) {
    case "daily":
      return out("day", 1, `${c} bills one day.`);
    case "flat":
      return out("day", 1, `${c} is a flat daily payment.`);
    case "session":
      return out("session", 1, `${c} bills one session.`);
    case "monthly":
      return out("month", 1, `${c} bills monthly.`);
    case "milestone":
      return out("milestone", 1, `${c} bills on its milestone.`);
    case "daily_tier": {
      const max = spec.maxTierHours ?? 6;
      const tier = Math.min(max, Math.max(1, Math.ceil(total / 60)));
      return out("tier", 1, `${c} bills the ${tier}-hour daily tier.`, tier);
    }
    default:
      break;
  }
  if (spec.dailyOverMinutes !== undefined && total > spec.dailyOverMinutes) {
    return out("day", 1, `${c} is over ${spec.dailyOverMinutes / 60} hours in the day, so it bills the daily rate (${spec.cite}).`);
  }
  if (spec.dailyAtLeastMinutes !== undefined && total >= spec.dailyAtLeastMinutes) {
    return out("day", 1, `${c} is ${spec.dailyAtLeastMinutes / 60} hours or more in the day, so it bills the daily rate (${spec.cite}).`);
  }
  if (opts.dailyRate && spec.dailyMode) return out("day", 1, `${c} billed at its daily rate by authorization.`);
  return out("quarter_hour", list.reduce((a, m) => a + entryQuarterHours(m), 0), "Quarter hours, each entry rounded to the nearest 15 minutes.");
}
