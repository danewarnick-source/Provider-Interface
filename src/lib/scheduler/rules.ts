// The scheduler rule engine: ONE place that answers "can this shift exist, and
// why not?" Pure; no database calls. Callers load the facts into a RuleContext
// (see rules-types.ts) and pass the proposed shift(s).
//
// Every finding is { rule, level: 'block' | 'warn', message, fix? }. SOW rules
// are always on; Agency rules follow ctx.settings. Evidence-based qualification
// reminders come from qualificationsOnDate (Decision 14) and are always warns
// (Decision 15). After S3, no other file may add its own "can this shift exist"
// check.
import { authorizationRule, enhancedStaffingRule, groupRules, hourCapRules, overlapRules,
  sameDayEmploymentRule, segmentRules, staffStatusRules, teamRules, twoToOneRule } from "./rules-core.ts";
import { absenceRule, asleepRule, custodyRule, mtpRules, nursingRules, relationshipCodeRule,
  supportedLivingRespiteRules } from "./rules-contract.ts";
import { behaviorConsultRule, daySupportRules, employmentRules, eprRules, hostHomeRules,
  residentialRule, respiteRules, tfbAndElsRules } from "./rules-contract2.ts";
import { qualificationFindings, qualificationsOnDate } from "./rules-qualifications.ts";
import type { Finding, RuleContext, RuleShift } from "./rules-types.ts";
import { clientOf, find, firstName, isLive, staffOf, up } from "./rules-util.ts";
import { assumedRatioRule, availabilityRule, dsiHoursRule, fatigueRule, overtimeRule, preferenceRule,
  restAndStraightRules, travelGapRule, windowRequirementRules, worksheetHoursRule } from "./rules-warn.ts";

export type { Finding, Fix, Level, RuleContext, RuleShift } from "./rules-types.ts";
export { qualificationsOnDate } from "./rules-qualifications.ts";

/** Minimum staff age (Decision 4): 16; 18 to drive or for DCFS/DJJYS clients; 21 for HHS/PPS. */
export function minStaffAgeForCode(
  code: string | null | undefined,
  opts: { driving?: boolean; custody?: "none" | "dcfs" | "djjys" | null; agencyFloor18?: boolean } = {},
): number {
  const c = up(code);
  if (c === "HHS" || c === "PPS") return 21;
  if (opts.driving || (opts.custody && opts.custody !== "none") || opts.agencyFloor18) return 18;
  return 16;
}

function ageRule(s: RuleShift, ctx: RuleContext): Finding[] {
  const staff = staffOf(ctx, s);
  if (!staff || staff.age === null) return [];
  const need = minStaffAgeForCode(s.code, {
    driving: !!s.driving, custody: clientOf(ctx, s)?.custody, agencyFloor18: !!ctx.settings.minAge18,
  });
  return staff.age < need
    ? [find("under_minimum_age", "block", `${firstName(staff.name)} is ${staff.age}; ${up(s.code)} here needs ${need}+ (Decision 4)`)]
    : [];
}

function qualificationRules(s: RuleShift, ctx: RuleContext): Finding[] {
  const staff = staffOf(ctx, s);
  if (!staff) return [];
  const client = clientOf(ctx, s);
  const results = qualificationsOnDate(staff, s, ctx.evidence[staff.id], {
    personKeys: s.clientId ? ctx.personTrainingKeys?.[s.clientId] : undefined,
    clientName: client?.name,
    behaviorSupport: client?.behaviorSupport,
    hasAbi: client?.hasAbi,
    driving: s.driving,
  });
  return qualificationFindings(results);
}

/** Every finding for one shift. `batch` = other shifts proposed in the same save. */
export function evaluateShift(shift: RuleShift, ctx: RuleContext, batch: readonly RuleShift[] = []): Finding[] {
  if (!isLive(shift)) return [];
  return [
    ...authorizationRule(shift, ctx, batch),
    ...teamRules(shift, ctx),
    ...staffStatusRules(shift, ctx),
    ...overlapRules(shift, ctx, batch),
    ...twoToOneRule(shift, ctx, batch),
    ...enhancedStaffingRule(shift, ctx, batch),
    ...ageRule(shift, ctx),
    ...segmentRules(shift, ctx, batch),
    ...sameDayEmploymentRule(shift, ctx, batch),
    ...groupRules(shift, ctx),
    ...hourCapRules(shift, ctx, batch),
    ...absenceRule(shift, ctx),
    ...custodyRule(shift, ctx),
    ...asleepRule(shift),
    ...supportedLivingRespiteRules(shift, ctx, batch),
    ...relationshipCodeRule(shift, ctx),
    ...mtpRules(shift, ctx, batch),
    ...nursingRules(shift, ctx, batch),
    ...respiteRules(shift, ctx),
    ...behaviorConsultRule(shift),
    ...hostHomeRules(shift, ctx),
    ...residentialRule(shift, ctx),
    ...employmentRules(shift, ctx, batch),
    ...eprRules(shift, ctx),
    ...daySupportRules(shift, ctx, batch),
    ...tfbAndElsRules(shift, ctx, batch),
    ...qualificationRules(shift, ctx),
    ...dsiHoursRule(shift, ctx, batch),
    ...worksheetHoursRule(shift, ctx, batch),
    ...restAndStraightRules(shift, ctx, batch),
    ...overtimeRule(shift, ctx, batch),
    ...fatigueRule(shift, ctx, batch),
    ...travelGapRule(shift, ctx, batch),
    ...preferenceRule(shift, ctx),
    ...assumedRatioRule(shift, ctx),
    ...availabilityRule(shift, ctx),
    ...windowRequirementRules(shift, ctx, batch),
  ];
}

/** Findings for a batch of proposed shifts, each tagged with its shiftId. */
export function evaluateShifts(shifts: readonly RuleShift[], ctx: RuleContext): Finding[] {
  return shifts.flatMap((s) =>
    evaluateShift(s, ctx, shifts.filter((o) => o.id !== s.id)).map((f) => ({ ...f, shiftId: s.id })));
}

export function hasBlock(findings: readonly Finding[]): boolean {
  return findings.some((f) => f.level === "block");
}

export function blocksOf(findings: readonly Finding[]): Finding[] {
  return findings.filter((f) => f.level === "block");
}

export function warningsOf(findings: readonly Finding[]): Finding[] {
  return findings.filter((f) => f.level === "warn");
}
