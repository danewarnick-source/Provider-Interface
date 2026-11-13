// How strong each scheduler rule is (Decision 4): Off / Warn / Needs a reason /
// Block. The Settings screen shows the SETTING_RULES below (the demo's list);
// each one covers one or more engine rule names. rules.ts calls applyStrength()
// on every finding, with the agency default and the home's override (B2), so
// callers only ever see final levels; verdictOf() turns them into "refuse",
// "ask for a reason" or "go ahead with warnings".
//   agency rules  Off / Warn / Needs a reason / Block.
//   state rules   no Off (contract rules the agency may tighten or loosen).
//   fixed         always Block, not shown (double-booking, minimum age incl.
//                 under 18 driving §1.5(1), no authorization).
// Engine rules in no group keep their own level. Stored in
// org_shift_behavior_settings.rule_settings and team_schedule_settings.rule_overrides,
// keyed by SettingRule.key.
import type { Finding, Strength } from "./rules-types.ts";

export type SettingRule = {
  key: string;
  label: string;
  hint: string;
  state: boolean;
  /** The agency default before anyone changes it. */
  initial: Strength;
  /** Engine rule names this setting covers. */
  rules: readonly string[];
  /** Threshold setting shown with the rule (org_shift_behavior_settings column). */
  threshold?: { column: ThresholdColumn; unit: string; options: readonly number[] };
};

export type ThresholdColumn = "ot_threshold_hours" | "hours_cap" | "min_rest_hours" | "max_days_in_row" | "max_hours_in_row";

export const SETTING_RULES: readonly SettingRule[] = [
  { key: "ot", label: "Overtime", hint: "Over a weekly hours threshold (federal overtime starts at 40 in a workweek).", state: false, initial: "warn", rules: ["overtime"], threshold: { column: "ot_threshold_hours", unit: "h a week", options: [36, 40, 44] } },
  { key: "cap", label: "Agency hours cap", hint: "No one is scheduled past this many hours a week. Staff can't change it.", state: false, initial: "reason", rules: ["over_hours_cap"], threshold: { column: "hours_cap", unit: "h a week", options: [48, 50, 56, 60] } },
  { key: "rest", label: "Rest between shifts", hint: "Hours off after a shift before the next one starts.", state: false, initial: "warn", rules: ["under_rest"], threshold: { column: "min_rest_hours", unit: "h", options: [8, 10, 12] } },
  { key: "days", label: "Days in a row", hint: "Working more days in a row than this.", state: false, initial: "warn", rules: ["over_days_in_row"], threshold: { column: "max_days_in_row", unit: "days", options: [5, 6, 7] } },
  { key: "row", label: "Hours in a row", hint: "Back-to-back shifts adding up to more than this.", state: false, initial: "warn", rules: ["over_hours_in_row"], threshold: { column: "max_hours_in_row", unit: "h", options: [12, 16, 18] } },
  { key: "avail", label: "Outside availability", hint: "Scheduled on a day they marked unavailable or their off weekend.", state: false, initial: "warn", rules: ["outside_availability"] },
  { key: "timeoff", label: "Approved time off", hint: "Scheduled on a day with approved time off.", state: false, initial: "reason", rules: ["on_time_off"] },
  { key: "team", label: "Not on the team", hint: "Scheduled with a client they aren't assigned to (or not for that code) in Team members.", state: false, initial: "warn", rules: ["not_on_team", "code_not_assigned"] },
  { key: "card", label: "Required Evidence item missing or expired", hint: "CPR, orientation, ABI, SEI training, the driver file and any agency-added item, per Evidence requirement settings.", state: true, initial: "warn", rules: ["general_training", "cpr_first_aid", "code_qualification", "behavior_training", "drivers_license", "driver_file", "window_qualification"] },
  { key: "ps", label: "Person-specific training not on file", hint: "No person-specific training item for that home or client.", state: true, initial: "warn", rules: ["person_training"] },
  { key: "auth", label: "Past the 1056", hint: "Hours past the authorization can't be billed.", state: true, initial: "reason", rules: ["over_authorized_units"] },
  { key: "dns", label: "Do-not-schedule request", hint: "A client or guardian asked that this team member not be scheduled with them.", state: true, initial: "block", rules: ["do_not_schedule"] },
  { key: "newhire", label: "New hire working alone", hint: "Not yet signed off for that home: they work paired shifts until a lead signs them off.", state: true, initial: "block", rules: ["new_hire_alone"] },
];

/** Always Block, whatever is stored. */
export const FIXED_RULES: ReadonlySet<string> = new Set([
  "staff_double_booked", "client_double_booked", "under_minimum_age", "no_authorization",
]);

const GROUP_OF = new Map<string, SettingRule>(SETTING_RULES.flatMap((g) => g.rules.map((r) => [r, g] as const)));

export function settingFor(rule: string): SettingRule | null {
  return FIXED_RULES.has(rule) ? null : GROUP_OF.get(rule) ?? null;
}

/** The strengths an agency may pick for a setting (state rules have no Off). */
export function strengthChoices(setting: Pick<SettingRule, "state">): readonly Strength[] {
  return setting.state ? ["warn", "reason", "block"] : ["off", "warn", "reason", "block"];
}

export type Strengths = Readonly<Record<string, Strength>>;

/** One setting's strength: the home's override, else the agency default, else its initial value. */
export function strengthOf(setting: SettingRule, agency?: Strengths, home?: Strengths): Strength {
  const allowed = strengthChoices(setting);
  for (const s of [home?.[setting.key], agency?.[setting.key]]) if (s && allowed.includes(s)) return s;
  return setting.initial;
}

/** Applies the strengths to findings. Fixed rules and rules in no setting keep their own level. */
export function applyStrength(findings: readonly Finding[], agency?: Strengths, home?: Strengths): Finding[] {
  const out: Finding[] = [];
  for (const f of findings) {
    const setting = settingFor(f.rule);
    if (!setting) { out.push(f); continue; }
    const s = strengthOf(setting, agency, home);
    if (s !== "off") out.push({ ...f, level: s });
  }
  return out;
}

export type Verdict = {
  /** Stop the action. */
  blocks: Finding[];
  /** Stop unless a reason is typed. */
  needReason: Finding[];
  /** Show, and go ahead. Includes reason-level findings once a reason is given. */
  warnings: Finding[];
};

export function verdictOf(findings: readonly Finding[], reason?: string | null): Verdict {
  const hasReason = !!reason?.trim();
  const v: Verdict = { blocks: [], needReason: [], warnings: [] };
  for (const f of findings) {
    if (f.level === "block") v.blocks.push(f);
    else if (f.level === "reason" && !hasReason) v.needReason.push(f);
    else v.warnings.push(f);
  }
  return v;
}

/** The one line a refused action shows, or null when it may go ahead. */
export function refusalLine(v: Verdict): string | null {
  const lines = v.blocks.length ? v.blocks : v.needReason;
  if (!lines.length) return null;
  const first = v.blocks.length
    ? lines[0]!.message
    : `Add a reason to go ahead: ${lines[0]!.message}`;
  return lines.length > 1 ? `${first} (+${lines.length - 1} more)` : first;
}

/** Distinct warning lines, for a toast. */
export function warningLines(v: Verdict): string[] {
  return [...new Set(v.warnings.map((f) => f.message))];
}
