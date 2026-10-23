// How strong each scheduler rule is for an agency (Decision 4): Off / Warn /
// Require a reason / Block. rules.ts calls applyStrength() on every finding it
// returns, so callers only ever see final levels; verdictOf() turns them into
// "refuse", "ask for a reason" or "go ahead with warnings".
//
// Kinds:
//   fixed    always block, whatever the setting (double-booking, minimum age,
//            no authorization: CLAUDE.md "no authorization → no shift").
//   agency   the agency's own rules (rest, overtime, fatigue, travel,
//            preference, availability): Off / Warn / Reason / Block.
//   card     Evidence cards and trainings: default Warn, may be Off up to Block.
//   contract every other (SOW-cited) rule: Warn / Reason / Block, never Off.
// The settings live in org_shift_behavior_settings.rule_settings (B2 edits them).
import type { Finding, Strength } from "./rules-types.ts";

export type RuleKind = "fixed" | "agency" | "card" | "contract";

const FIXED = new Set([
  "staff_double_booked",
  "client_double_booked",
  "under_minimum_age",
  "no_authorization",
]);
const AGENCY = new Set([
  "under_rest",
  "over_16h_straight",
  "overtime",
  "fatigue_16_in_24",
  "travel_gap",
  "client_preference",
  "outside_availability",
]);
const CARD = new Set([
  "general_training",
  "person_training",
  "cpr_first_aid",
  "code_qualification",
  "behavior_training",
  "drivers_license",
  "driver_file",
  "window_qualification",
]);

export function ruleKind(rule: string): RuleKind {
  if (FIXED.has(rule)) return "fixed";
  if (AGENCY.has(rule)) return "agency";
  if (CARD.has(rule)) return "card";
  return "contract";
}

/** The strengths an agency may pick for a rule (B2 shows exactly these). */
export function strengthChoices(rule: string): readonly Strength[] {
  const kind = ruleKind(rule);
  if (kind === "fixed") return ["block"];
  if (kind === "contract") return ["warn", "reason", "block"];
  return ["off", "warn", "reason", "block"];
}

/** Applies the agency's strengths. A missing or not-allowed setting keeps the rule's own level. */
export function applyStrength(
  findings: readonly Finding[],
  rules?: Readonly<Record<string, Strength>>,
): Finding[] {
  const out: Finding[] = [];
  for (const f of findings) {
    const chosen = rules?.[f.rule];
    if (!chosen || !strengthChoices(f.rule).includes(chosen)) {
      out.push(f);
      continue;
    }
    if (chosen !== "off") out.push({ ...f, level: chosen });
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
