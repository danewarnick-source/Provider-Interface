// Goal carry-over: match the new PCSP's goals to the current plan's goals so
// progress history continues. Uses the PCSP's "Annual Review for Goals"
// (Ongoing Goal for New Plan? Y/N) plus plain text similarity. Only a
// proposal — the person confirms each match on the review screen.

import type { LastYearGoal } from "./parser-shared.ts";

export type CarryKind = "continuing" | "changed" | "new";

export interface CarryProposal {
  /** Index into the new PCSP's goals. */
  index: number;
  kind: CarryKind;
  fromGoalId: string | null;
  fromGoalText: string | null;
  /** 0–1 word overlap with the matched goal. */
  similarity: number;
  /** Last year's review said this goal continues (true), stops (false), or didn't say (null). */
  ongoing: boolean | null;
}

export interface CarryOver {
  goals: CarryProposal[];
  /** Current goals no new goal matches: they end with the old plan. */
  ended: { goalId: string; goalText: string; ongoing: boolean | null }[];
}

const STOP = new Set(["a", "an", "and", "the", "to", "of", "in", "at", "on", "for", "with", "will", "be", "is", "each", "by", "my", "his", "her", "their"]);

function words(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)),
  );
}

/** Word overlap (Jaccard) between two goal texts, 0–1. */
export function goalSimilarity(a: string, b: string): number {
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let both = 0;
  for (const w of wa) if (wb.has(w)) both++;
  return both / (wa.size + wb.size - both);
}

const SAME = 0.9;
const CHANGED = 0.5;
/** A goal last year's review marked ongoing may match on less overlap. */
const CHANGED_IF_ONGOING = 0.3;
const REVIEW_MATCH = 0.6;

/** Last year's "ongoing" answer for a current goal (by best text match), or null. */
function ongoingFor(goalText: string, lastYear: readonly LastYearGoal[]): boolean | null {
  let best: LastYearGoal | null = null, bestSim = 0;
  for (const g of lastYear) {
    const s = goalSimilarity(goalText, g.goal);
    if (s > bestSim) { best = g; bestSim = s; }
  }
  return best && bestSim >= REVIEW_MATCH ? best.ongoing : null;
}

export function proposeCarryOver(
  newGoals: readonly string[],
  current: readonly { id: string; goal_text: string }[],
  lastYear: readonly LastYearGoal[],
): CarryOver {
  const ongoing = new Map(current.map((c) => [c.id, ongoingFor(c.goal_text, lastYear)]));
  const pairs: { i: number; c: (typeof current)[number]; sim: number }[] = [];
  newGoals.forEach((g, i) => {
    for (const c of current) {
      const sim = goalSimilarity(g, c.goal_text);
      const min = ongoing.get(c.id) === true ? CHANGED_IF_ONGOING : CHANGED;
      if (sim >= min) pairs.push({ i, c, sim });
    }
  });
  // Best matches first; each new goal and each current goal is used once.
  pairs.sort((a, b) => b.sim - a.sim || a.i - b.i);
  const usedNew = new Map<number, (typeof pairs)[number]>();
  const usedCur = new Set<string>();
  for (const p of pairs) {
    if (usedNew.has(p.i) || usedCur.has(p.c.id)) continue;
    usedNew.set(p.i, p);
    usedCur.add(p.c.id);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    goals: newGoals.map((_, index) => {
      const p = usedNew.get(index);
      if (!p) return { index, kind: "new", fromGoalId: null, fromGoalText: null, similarity: 0, ongoing: null };
      return {
        index, kind: p.sim >= SAME ? "continuing" : "changed", fromGoalId: p.c.id, fromGoalText: p.c.goal_text,
        similarity: round(p.sim), ongoing: ongoing.get(p.c.id) ?? null,
      };
    }),
    ended: current.filter((c) => !usedCur.has(c.id)).map((c) => ({ goalId: c.id, goalText: c.goal_text, ongoing: ongoing.get(c.id) ?? null })),
  };
}
