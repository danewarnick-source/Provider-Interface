// Support strategies: the instructions telling staff how to help the client
// with each PCSP support paid to the agency. One section per support (with
// its goal, codes and details, read-only) plus the one field a person writes,
// "Support strategy". Sections a person edited are never overwritten when the
// strategies are rebuilt. The strategy is 4–6 "- " bullet lines; supports
// whose codes need no strategy (strategy-rules.ts) are listed with the reason.
// Pure (no Supabase), importable by node --test.

import { formatDate } from "./dates.ts";
import type { GoalView } from "./plans.ts";
import { parseBullets, strategyNeed, type StrategyNeed } from "./strategy-rules.ts";
import type { CSTContent, CSTSection } from "./training.functions.ts";

export const STRATEGY_LABEL = {
  goal: "Goal",
  support: "Support",
  details: "Support details",
  strategy: "Support strategy",
} as const;
/** Labels the per-goal strategies used before they were per support. */
const LEGACY_LABEL = { goal: "Goal this supports", strategy: "Instructions to staff" } as const;
/** The Goal line of a strategy for a non-goal support. */
export const OTHER_NEED_LABEL = "Other need in the PCSP";

/** A plan support paid to the agency: what a strategy is written for. */
export type StrategySupport = {
  supportId: string;
  goal: string;
  support: string;
  details: string;
  codes: string[];
};

/** Whether this support needs a strategy of its own (§1.24(5)). */
export const supportNeedsStrategy = (s: { codes: readonly string[] }) =>
  strategyNeed(s.codes).kind === "needed";

/** Every current-plan support with at least one of the agency's codes, in plan order (other needs last). */
export function agencySupports(goals: readonly GoalView[]): StrategySupport[] {
  const ordered = [
    ...goals.filter((g) => g.kind !== "other_need"),
    ...goals.filter((g) => g.kind === "other_need"),
  ];
  return ordered.flatMap((g) =>
    g.supports
      .filter((s) => s.our_codes.length > 0)
      .map((s) => ({
        supportId: s.id,
        goal: g.kind === "other_need" ? OTHER_NEED_LABEL : g.goal,
        support: s.support_text.trim(),
        details: (s.details ?? "").trim(),
        codes: [...s.our_codes],
      })),
  );
}

/** One section's fields, read by label (older per-goal sections included). */
export type StrategyView = {
  id: string;
  supportId: string | null;
  goal: string;
  support: string;
  details: string;
  codes: string[];
  strategy: string;
  /** The strategy's bullet points. */
  bullets: string[];
  /** Needed, or why not (exempt / covered by the BSP or Medical Care Plan). */
  need: StrategyNeed;
  edited: boolean;
  /** Nectar drafted it and no person has edited it since. */
  nectar: boolean;
};

export function strategyView(sec: CSTSection): StrategyView {
  const text = (...labels: string[]) => {
    const item = sec.items.find((i) => labels.includes(i.label));
    return item && (item.kind === "text" || item.kind === "note") ? item.value : "";
  };
  return {
    id: sec.id,
    supportId: sec.support_id ?? null,
    goal: text(STRATEGY_LABEL.goal, LEGACY_LABEL.goal),
    support: text(STRATEGY_LABEL.support),
    details: text(STRATEGY_LABEL.details),
    codes: sec.job_codes ?? [],
    strategy: text(STRATEGY_LABEL.strategy, LEGACY_LABEL.strategy),
    bullets: parseBullets(text(STRATEGY_LABEL.strategy, LEGACY_LABEL.strategy)),
    need: strategyNeed(sec.job_codes ?? []),
    edited: sec.edited === true,
    nectar: sec.nectar === true && sec.edited !== true,
  };
}

/** A section for one support with its strategy text (`nectar`: a Nectar draft). */
export function strategySection(
  s: StrategySupport,
  strategy: string,
  keep?: { id: string; edited: boolean },
  nectar = false,
): CSTSection {
  return {
    id: keep?.id ?? `ss_${s.supportId}`,
    title: (s.support || "Support strategy").slice(0, 200),
    support_id: s.supportId,
    job_codes: [...s.codes],
    ...(keep?.edited ? { edited: true } : {}),
    ...(nectar && !keep?.edited ? { nectar: true } : {}),
    items: [
      { kind: "text", label: STRATEGY_LABEL.goal, value: s.goal },
      { kind: "text", label: STRATEGY_LABEL.support, value: s.support },
      { kind: "text", label: STRATEGY_LABEL.details, value: s.details },
      { kind: "text", label: STRATEGY_LABEL.strategy, value: strategy },
    ],
  };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Edited sections matched to current supports: by support id, else (after a
 * new PCSP gives the supports new ids) by the same support wording.
 */
export function editedFor(
  supports: readonly StrategySupport[],
  existing: readonly CSTSection[],
): Map<string, CSTSection> {
  const out = new Map<string, CSTSection>();
  const used = new Set<string>();
  const edited = existing.filter((e) => e.edited);
  const ids = new Set(supports.map((s) => s.supportId));
  for (const s of supports) {
    const byId = edited.find((e) => !used.has(e.id) && e.support_id === s.supportId);
    const byText =
      byId ??
      edited.find(
        (e) =>
          !used.has(e.id) &&
          (!e.support_id || !ids.has(e.support_id)) &&
          !!s.support &&
          norm(strategyView(e).support) === norm(s.support),
      );
    if (byText) {
      used.add(byText.id);
      out.set(s.supportId, byText);
    }
  }
  return out;
}

/** Supports needing a strategy with no edited section: the ones Nectar drafts on a rebuild. */
export function supportsToDraft(
  supports: readonly StrategySupport[],
  existing: readonly CSTSection[],
): StrategySupport[] {
  const kept = editedFor(supports, existing);
  return supports.filter((s) => supportNeedsStrategy(s) && !kept.has(s.supportId));
}

/**
 * The rebuilt list: one section per agency support. An edited section keeps
 * its strategy (the PCSP fields beside it are refreshed); others take the
 * new draft. Edited sections whose support is gone stay at the end.
 */
export function buildStrategySections(
  supports: readonly StrategySupport[],
  existing: readonly CSTSection[],
  drafts: ReadonlyMap<string, string>,
): CSTSection[] {
  const kept = editedFor(supports, existing);
  const out = supports.map((s) => {
    const k = kept.get(s.supportId);
    return k
      ? strategySection(s, strategyView(k).strategy, { id: k.id, edited: true })
      : strategySection(s, drafts.get(s.supportId) ?? "", undefined, !!drafts.get(s.supportId));
  });
  const usedIds = new Set([...kept.values()].map((k) => k.id));
  return [...out, ...existing.filter((e) => e.edited && !usedIds.has(e.id))];
}

/** Strategies kept as one uploaded document (a single file link) instead of per support. */
export function isUploadDoc(content: CSTContent | null | undefined): boolean {
  const s = content?.sections ?? [];
  return s.length === 1 && s[0].items.length === 1 && s[0].items[0].kind === "link";
}

/** "N of M supports have a strategy", and which don't (supports needing none are not counted). */
export function strategyCoverage(
  all: readonly StrategySupport[],
  sections: readonly CSTSection[],
): { covered: number; total: number; missing: StrategySupport[] } {
  const supports = all.filter(supportNeedsStrategy);
  const written = new Set(
    sections
      .map(strategyView)
      .filter((v) => v.supportId && v.strategy.trim())
      .map((v) => v.supportId!),
  );
  const missing = supports.filter((s) => !written.has(s.supportId));
  return { covered: supports.length - missing.length, total: supports.length, missing };
}

/** The content with one section's strategy replaced, marked as edited by a person. */
export function withStrategy(content: CSTContent, sectionId: string, text: string): CSTContent {
  return {
    ...content,
    sections: content.sections.map((sec) =>
      sec.id !== sectionId
        ? sec
        : {
            ...sec,
            edited: true,
            nectar: undefined,
            items: sec.items.map((i) =>
              i.kind === "text" &&
              (i.label === STRATEGY_LABEL.strategy || i.label === LEGACY_LABEL.strategy)
                ? { ...i, value: text }
                : i,
            ),
          },
    ),
  };
}

export type StrategyStatus =
  | { kind: "draft" }
  | { kind: "approved"; at: string; by: string }
  | { kind: "outdated" };

/**
 * Draft until approved; out of date once the PCSP changed after approval
 * (a newer plan year, or a support added or removed).
 */
export function strategyStatus(
  training: { status: string; approved_at: string | null },
  approverName: string | null,
  plan: { created_at?: string | null } | null,
  supports: readonly StrategySupport[],
  sections: readonly CSTSection[],
): StrategyStatus {
  if (training.status !== "published" || !training.approved_at) return { kind: "draft" };
  const ids = new Set(supports.map((s) => s.supportId));
  const linked = sections.map((s) => s.support_id).filter((x): x is string => !!x);
  const changed =
    (!!plan?.created_at && plan.created_at > training.approved_at) ||
    linked.some((id) => !ids.has(id)) ||
    supports.some((s) => !linked.includes(s.supportId));
  if (changed) return { kind: "outdated" };
  return { kind: "approved", at: training.approved_at, by: approverName ?? "a team member" };
}

export function strategyStatusText(s: StrategyStatus): string {
  if (s.kind === "draft") return "Draft: review and approve";
  if (s.kind === "outdated") return "Out of date: the PCSP changed since these were approved";
  return `Approved ${formatDate(s.at)} by ${s.by}`;
}

/** Sections in display groups, one per goal, in order. */
export function groupByGoal(
  views: readonly StrategyView[],
): { goal: string; items: StrategyView[] }[] {
  const out: { goal: string; items: StrategyView[] }[] = [];
  for (const v of views) {
    const last = out[out.length - 1];
    if (last && last.goal === v.goal) last.items.push(v);
    else out.push({ goal: v.goal, items: [v] });
  }
  return out;
}
