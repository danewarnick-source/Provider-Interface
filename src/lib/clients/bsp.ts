// Behavior support plan (BSP): only clients receiving behavior consultation
// (BC1–BC3) need one on file. The code may be ours (an active
// authorization) or another agency's (a support's other providers in the
// current plan). Pure, importable by node --test.

import type { ClientGoal } from "./plans.ts";

export const BEHAVIOR_CODES = new Set(["BC1", "BC2", "BC3"]);

export function needsBehaviorSupportPlan(
  codes: readonly string[],
  goals: readonly Pick<ClientGoal, "status" | "supports">[] = [],
): boolean {
  if (codes.some((c) => BEHAVIOR_CODES.has(c.trim().toUpperCase()))) return true;
  return goals.some(
    (g) =>
      g.status === "active" &&
      g.supports.some((s) => s.other_providers.some((p) => BEHAVIOR_CODES.has(p.code.trim().toUpperCase()))),
  );
}
