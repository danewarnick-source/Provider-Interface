// Progress summaries work from the plan in effect at the end of the period:
// its goals, with the supports for the codes the summary covers. Pure.

import { goalsOn, supportsForCodes, type ClientPlanBundle } from "./plans.ts";

export interface SummaryGoal {
  id: string;
  goal: string;
  /** Codes on this goal's supports that the summary covers. */
  job_codes: string[];
  /** The supports for those codes, as the support strategies document shows them (blank ones dropped). */
  supports: SummarySupport[];
}

export interface SummarySupport {
  support: string;
  details: string;
  codes: string[];
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
      supports: supports
        .map((s) => ({ support: s.support_text.trim(), details: (s.details ?? "").trim(), codes: s.our_codes }))
        .filter((s) => s.support || s.details),
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-Q4" → "Q4 2026"; "2026-10" (or a statement's "2026-10-FS") → "Oct 2026"; null when unreadable. */
export function summaryPeriodName(label: string | null | undefined): string | null {
  const q = /^(\d{4})-Q([1-4])$/.exec(label ?? "");
  if (q) return `Q${q[2]} ${q[1]}`;
  const m = /^(\d{4})-(\d{2})(?:-FS)?$/.exec(label ?? "");
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  return null;
}

/** "View Q3 2026 summary" once finalized, otherwise "Open Q4 2026 summary". */
export function summaryButtonLabel(row: { period_label: string | null; status: string | null }): string {
  const name = summaryPeriodName(row.period_label);
  const verb = row.status === "finalized" ? "View" : "Open";
  return name ? `${verb} ${name} summary` : `${verb} summary`;
}

/** The period a summary started today covers: this month when any code owes monthly ones, else this quarter. */
export function currentSummaryPeriod(
  cadences: readonly string[],
  now: Date = new Date(),
): { kind: "monthly" | "quarterly"; label: string } {
  const y = now.getFullYear();
  if (cadences.includes("monthly")) {
    return { kind: "monthly", label: `${y}-${String(now.getMonth() + 1).padStart(2, "0")}` };
  }
  return { kind: "quarterly", label: `${y}-Q${Math.floor(now.getMonth() / 3) + 1}` };
}
