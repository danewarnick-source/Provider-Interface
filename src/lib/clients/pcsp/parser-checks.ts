// Things a person should check after the PCSP is read: missing dates/goals,
// codes not approved for the agency, support dates outside the plan, and the
// budget ↔ purchased services ↔ goal supports cross-check.

import type { PcspOptions, PcspResult } from "./parser-shared.ts";

export function runChecks(res: PcspResult, opts: PcspOptions): void {
  const { issues } = res;
  // With no approved-code list set up for the agency there is nothing to compare against.
  const checkCodes = opts.agencyCodes.length > 0;
  if (!checkCodes) issues.push({ level: "info", message: "Your agency's approved codes aren't set up, so codes weren't checked against them." });
  if (!res.plan.start || !res.plan.end) issues.push({ level: "error", message: "Plan start or end date not found." });
  if (!res.plan.activatedOn) issues.push({ level: "warn", message: "Plan activation date not found." });
  if (!res.goals.length) issues.push({ level: "error", message: "No goals found." });
  for (const g of res.goals) {
    if (!g.supports.length) issues.push({ level: "warn", page: g.page, message: `Goal "${g.goal.slice(0, 60)}" has no supports.` });
    else if (!g.supports.some((s) => s.ourCodes.length)) issues.push({ level: "info", page: g.page, message: `Goal "${g.goal.slice(0, 60)}" has no supports paid to your agency.` });
    for (const s of g.supports) {
      if (!s.support) issues.push({ level: "warn", page: s.page, message: `A support under "${g.goal.slice(0, 50)}" has no support text.` });
      if (checkCodes) {
        for (const c of s.ourCodes) {
          if (!opts.agencyCodes.includes(c)) issues.push({ level: "error", page: s.page, message: `Code ${c} is listed for your agency but isn't one of your approved codes.` });
        }
      }
      if (s.start && res.plan.start && s.start < res.plan.start) issues.push({ level: "warn", page: s.page, message: `Support starts ${s.start}, before the plan starts.` });
      if (s.end && res.plan.end && s.end > res.plan.end) issues.push({ level: "warn", page: s.page, message: `Support ends ${s.end}, after the plan ends.` });
    }
  }
  const ours = res.budget.filter((x) => x.ours);
  for (const b of ours) {
    if (checkCodes && !opts.agencyCodes.includes(b.code)) issues.push({ level: "error", message: `Budget line ${b.code} is for your agency but isn't one of your approved codes.` });
    const ps = res.purchasedServices.find((p) => p.code === b.code);
    if (!ps) issues.push({ level: "warn", message: `Budget line ${b.code} isn't in the purchased services list.` });
    else if (ps.units !== b.annualUnits) issues.push({ level: "error", message: `${b.code}: budget says ${b.annualUnits} units, purchased services says ${ps.units}.` });
  }
  const supportCodes = new Set(res.goals.flatMap((g) => g.supports.flatMap((s) => s.ourCodes)));
  for (const b of ours) {
    if (!supportCodes.has(b.code)) issues.push({ level: "warn", message: `${b.code} has a budget but no goal support lists it, so staff on ${b.code} would have nothing to report on.` });
  }
}
