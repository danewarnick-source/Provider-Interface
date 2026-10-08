// "Focus for this shift": what staff see at clock in / clock out and on daily
// notes so the note ties back to the PCSP and support strategies (SOW
// §1.24(6), §18.3(2)(E)). The goals for the shift's code with the first
// strategy bullets, consolidated to at most 3 lines, plus everything (goal,
// support, details, all bullets) behind "See all". Only APPROVED strategies
// are used; without them staff see the goals and supports only.
// Pure (no Supabase), node --test.

import type { GoalView } from "./plans.ts";
import type { CSTContent } from "./training.functions.ts";
import { isUploadDoc, strategyView } from "./support-strategies.ts";

/** Approved strategy bullets per support (id and wording, to match after a new PCSP). */
export type ApprovedStrategy = { supportId: string | null; support: string; bullets: string[] };

export const FOCUS_MAX_LINES = 3;

/** Bullets from the support strategies row, only when it is approved (published). */
export function approvedStrategies(
  row: { status: string | null; approved_at: string | null; content: CSTContent | null } | null,
): ApprovedStrategy[] {
  if (!row || row.status !== "published" || !row.approved_at || !row.content) return [];
  if (isUploadDoc(row.content)) return [];
  return row.content.sections
    .map(strategyView)
    .filter((v) => v.need.kind === "needed" && v.bullets.length > 0)
    .map((v) => ({ supportId: v.supportId, support: v.support, bullets: v.bullets }));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export type FocusSupport = { id: string; support: string; details: string; bullets: string[] };
export type FocusGoal = { id: string; goal: string; supports: FocusSupport[] };
export type FocusLine = { goal: string; bullets: string[] };
export type ShiftFocus = {
  /** The consolidated view: up to 3 goals, each with its first strategy bullet. */
  lines: FocusLine[];
  /** Everything, for "See all". */
  goals: FocusGoal[];
  /** Any approved strategy matched a support for this shift. */
  hasStrategies: boolean;
};

/** Goals (already narrowed to the shift's code) joined to their approved strategies. */
export function shiftFocus(
  groups: readonly GoalView[],
  strategies: readonly ApprovedStrategy[],
): ShiftFocus {
  const byId = new Map(strategies.filter((s) => s.supportId).map((s) => [s.supportId!, s]));
  const bulletsFor = (id: string, text: string) =>
    (byId.get(id) ?? strategies.find((s) => !!text.trim() && norm(s.support) === norm(text)))
      ?.bullets ?? [];

  const goals: FocusGoal[] = groups.map((g) => ({
    id: g.id,
    goal: g.goal,
    supports: g.supports.map((s) => ({
      id: s.id,
      support: s.support_text.trim(),
      details: (s.details ?? "").trim(),
      bullets: bulletsFor(s.id, s.support_text),
    })),
  }));

  // One line per goal (first strategy bullet of its supports, else the
  // support itself); a single goal gets its first two strategies.
  const lines: FocusLine[] = goals.slice(0, FOCUS_MAX_LINES).map((g) => {
    const firsts = g.supports.flatMap((s) => s.bullets.slice(0, 1));
    const pool = firsts.length ? firsts : g.supports.map((s) => s.support).filter(Boolean);
    const one = goals.length === 1 ? (g.supports[0]?.bullets.slice(0, 2) ?? []) : [];
    return { goal: g.goal, bullets: one.length > 1 ? one : pool.slice(0, 1) };
  });
  return {
    lines,
    goals,
    hasStrategies: goals.some((g) => g.supports.some((s) => s.bullets.length > 0)),
  };
}
