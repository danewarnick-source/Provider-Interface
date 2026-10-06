// Progress summaries work from the plan in effect at the end of the period:
// its goals, with the supports for the codes the summary covers. Pure.

import { goalsOn, supportsForCodes, type ClientPlanBundle } from "./plans.ts";

export interface SummaryGoal {
  id: string;
  goal: string;
  /** Codes on this goal's supports that the summary covers. */
  job_codes: string[];
  /** Support texts for those codes (blank ones dropped). */
  supports: string[];
}

/**
 * Goals for a summary of `codes` ending `periodEnd`. With no codes, every
 * active goal of that plan with all its supports.
 */
export function summaryGoals(
  bundle: ClientPlanBundle | null | undefined,
  periodEnd: string,
  codes: readonly string[],
): { planId: string | null; goals: SummaryGoal[] } {
  const { plan, goals } = goalsOn(bundle, periodEnd);
  const active = goals.filter((g) => g.status === "active").sort((a, b) => a.sort - b.sort);
  const groups = codes.length
    ? supportsForCodes(active, codes, periodEnd)
    : active.map((g) => ({ goal: g, supports: g.supports }));
  const want = new Set(codes.map((c) => c.trim().toUpperCase()));
  return {
    planId: plan?.id ?? null,
    goals: groups.map(({ goal, supports }) => ({
      id: goal.id,
      goal: goal.goal_text,
      job_codes: [...new Set(supports.flatMap((s) => s.our_codes))].filter((c) => !want.size || want.has(c)).sort(),
      supports: supports.map((s) => s.support_text.trim()).filter(Boolean),
    })),
  };
}

/** A note's record of what it worked on: goal ids (new notes) and/or text labels (older notes). */
export interface NoteGoalTags {
  goal_ids?: readonly string[] | null;
  addressed?: readonly string[] | null;
}

/**
 * True when the note addressed this goal: by goal id, or by its text label
 * (the goal itself, or "goal — support" as notes write it).
 */
export function noteAddressesGoal(note: NoteGoalTags, goal: Pick<SummaryGoal, "id" | "goal">): boolean {
  if (note.goal_ids?.includes(goal.id)) return true;
  const text = goal.goal.trim().toLowerCase();
  return (note.addressed ?? []).some((raw) => {
    const a = String(raw).trim().toLowerCase();
    return a === text || a.startsWith(`${text} — `);
  });
}

export function noteAddressesAny(note: NoteGoalTags, goals: ReadonlyArray<Pick<SummaryGoal, "id" | "goal">>): boolean {
  return goals.some((g) => noteAddressesGoal(note, g));
}
