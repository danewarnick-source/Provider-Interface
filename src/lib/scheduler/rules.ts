// The scheduler rule engine: ONE place that answers "can this shift exist, and
// why not?" Pure; no database calls. Callers load the facts into a RuleContext
// (see rules-types.ts) and pass the proposed shift(s).
//
// Every finding is { rule, level: 'block' | 'reason' | 'warn', message, fix? }.
// Each rule returns its default level; applyStrength (rules-strength.ts) then
// applies the agency's Off / Warn / Reason / Block choice from ctx.settings.
// Evidence reminders come from qualificationsOnDate (default Warn). No other
// file may add its own "can this shift exist" check: server callers go through
// shift-guard.server.ts.
import { authorizationRule, enhancedStaffingRule, groupRules, hourCapRules, overlapRules,
  sameDayEmploymentRule, segmentRules, staffStatusRules, teamRules, twoToOneRule } from "./rules-core.ts";
import { absenceRule, asleepRule, custodyRule, mtpRules, nursingRules, relationshipCodeRule,
  supportedLivingRespiteRules } from "./rules-contract.ts";
import { behaviorConsultRule, daySupportRules, employmentRules, eprRules, hostHomeRules,
  residentialRule, respiteRules, tfbAndElsRules } from "./rules-contract2.ts";
import { driverFileFindings, qualificationFindings, qualificationsOnDate } from "./rules-qualifications.ts";
import { applyStrength } from "./rules-strength.ts";
import type { Finding, RuleContext, RuleShift } from "./rules-types.ts";
import { clientOf, find, firstName, isLive, staffOf, up } from "./rules-util.ts";
import { assumedRatioRule, availabilityRule, fatigueRule, overtimeRule, preferenceRule,
  restAndStraightRules, travelGapRule, windowRequirementRules, worksheetHoursRule } from "./rules-warn.ts";

export type { Finding, Fix, Level, RuleContext, RuleShift, Strength } from "./rules-types.ts";
export { qualificationsOnDate } from "./rules-qualifications.ts";

/** Minimum staff age (Decision 3): 16; 18 to drive (§1.5(1)) or for DCFS/DJJYS clients; 21 for HHS/PPS. */
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
  const driving = !!s.driving || !!s.vanRouteId;
  const need = minStaffAgeForCode(s.code, {
    driving, custody: clientOf(ctx, s)?.custody, agencyFloor18: !!ctx.settings.minAge18,
  });
  if (staff.age >= need) return [];
  const what = driving && need === 18 ? "driving clients" : `${up(s.code)} here`;
  return [find("under_minimum_age", "block",
    `${firstName(staff.name)} is ${staff.age}; ${what} needs ${need}+${driving ? " (§1.5(1))" : ""}`)];
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
    // A van driver's license is part of the driver file below.
    driving: s.driving && !s.vanRouteId,
  });
  const driverFile = s.vanRouteId ? driverFileFindings(staff, s, ctx.evidence[staff.id]) : [];
  return [...qualificationFindings(results), ...driverFile];
}

/** Every finding for one shift, at the agency's strengths. `batch` = other shifts proposed in the same save. */
export function evaluateShift(shift: RuleShift, ctx: RuleContext, batch: readonly RuleShift[] = []): Finding[] {
  if (!isLive(shift)) return [];
  return applyStrength(rawFindings(shift, ctx, batch), ctx.settings.rules);
}

function rawFindings(shift: RuleShift, ctx: RuleContext, batch: readonly RuleShift[]): Finding[] {
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

export { refusalLine, verdictOf, warningLines, type Verdict } from "./rules-strength.ts";
