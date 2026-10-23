// The scheduling settings' shapes and labels, and what a home does differently
// from the agency (the "Settings for <home>" card and the Settings header
// count). Pure. Owner tables: org_shift_behavior_settings (agency defaults),
// team_schedule_settings (per home), shift_types, agency_holidays,
// new_hire_signoffs. Loaded and saved by settings*.functions.ts.
import type { Database } from "../../../integrations/supabase/types.ts";
import { SETTING_RULES, strengthOf, type Strengths } from "../rules-strength.ts";
import type { Strength } from "../rules-types.ts";
import { PICKUP_LABEL, pickupModeFor } from "./pickup.ts";

type Tables = Database["public"]["Tables"];
export type AgencySchedulingSettings = Tables["org_shift_behavior_settings"]["Row"];
export type TeamScheduleSettings = Pick<Tables["team_schedule_settings"]["Row"], "team_id"> &
  Partial<Omit<Tables["team_schedule_settings"]["Row"], "team_id">>;
export type ShiftType = Tables["shift_types"]["Row"];
export type AgencyHoliday = Tables["agency_holidays"]["Row"];

export type Approver = "lead" | "owner";
export type ApprovalKind = "swap" | "timeoff" | "fix" | "publish";

/** Who approves what when a home sets nothing (the demo's defaults). */
export const APPROVAL_DEFAULTS: Record<ApprovalKind, Approver> = {
  swap: "lead",
  timeoff: "owner",
  fix: "lead",
  publish: "owner",
};
export const APPROVAL_LABEL: Record<ApprovalKind, string> = {
  swap: "Swaps",
  timeoff: "Time off",
  fix: "Punch fixes",
  publish: "Publish the week",
};
export const APPROVER_LABEL: Record<Approver, string> = { lead: "Lead", owner: "Owner only" };

export type OvernightPay = "every" | "sleeprate" | "exclude";
export const OVERNIGHT_LABEL: Record<OvernightPay, string> = {
  every: "Pay every hour",
  sleeprate: "Sleep rate",
  exclude: "Exclude sleep (24 h+)",
};

export const STRENGTH_LABEL: Record<Strength, string> = {
  off: "Off",
  warn: "Warn",
  reason: "Needs a reason",
  block: "Block",
};

export function money(n: number): string {
  return `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;
}

export function overnightLine(pay: OvernightPay, sleepRate: number): string {
  if (pay === "sleeprate") return `Sleep rate ${money(sleepRate)}/h`;
  if (pay === "exclude") return OVERNIGHT_LABEL.exclude;
  return "Every hour at the normal rate";
}

export type DifferenceRow = { label: string; value: string };

/** Only what this home does differently from the agency defaults. */
export function homeDifferences(
  agency: AgencySchedulingSettings,
  home: TeamScheduleSettings | null,
): DifferenceRow[] {
  if (!home) return [];
  const rows: DifferenceRow[] = [];
  const agencyRules = (agency.rule_settings ?? {}) as Strengths;
  const overrides = (home.rule_overrides ?? {}) as Strengths;
  for (const rule of SETTING_RULES) {
    if (!overrides[rule.key]) continue;
    rows.push({
      label: rule.label,
      value: `${STRENGTH_LABEL[strengthOf(rule, agencyRules, overrides)]} (agency: ${STRENGTH_LABEL[strengthOf(rule, agencyRules)]})`,
    });
  }
  if (home.overnight_pay && home.overnight_pay !== "every") {
    rows.push({
      label: "Overnight pay",
      value: overnightLine(home.overnight_pay as OvernightPay, agency.sleep_rate),
    });
  }
  if (home.premium_per_hour)
    rows.push({ label: "Premium", value: `+${money(home.premium_per_hour)}/h` });
  const pickup = pickupModeFor(agency.claim_mode, home.pickup_approval);
  if (home.pickup_approval && pickup !== pickupModeFor(agency.claim_mode, null)) {
    rows.push({ label: "Open shift pickups", value: PICKUP_LABEL[pickup] });
  }
  for (const kind of Object.keys(APPROVAL_DEFAULTS) as ApprovalKind[]) {
    const v = home[`${kind}_approval` as const] as Approver | null | undefined;
    if (v && v !== APPROVAL_DEFAULTS[kind])
      rows.push({ label: APPROVAL_LABEL[kind], value: APPROVER_LABEL[v] });
  }
  return rows;
}

/** How many place-specific settings the agency has (Settings header). */
export function differenceCount(
  agency: AgencySchedulingSettings,
  homes: readonly TeamScheduleSettings[],
): number {
  return homes.reduce((n, h) => n + homeDifferences(agency, h).length, 0);
}
