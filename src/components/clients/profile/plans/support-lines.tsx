// One support, labeled the same way everywhere (PCSP review, Goals and
// supports, Support strategies): "Support: <text> + code badges" and
// "Support details: <details>" (or "None listed"). Plus the goal block
// classes both cards share, so goals and supports read the same in each.

import type { ReactNode } from "react";

/** A goal's block: a firm border and a green bar on the left where the goal starts. */
export const GOAL_BLOCK =
  "overflow-hidden rounded-xl border border-hive-steel/60 border-l-4 border-l-[var(--hive-ok)] bg-hive-surface";
/** The strip at the top of a goal's block that holds its title. */
export const GOAL_HEAD = "border-b border-hive-steel/40 bg-[var(--hive-muted-surface)] px-4 py-3";
/** A goal's title: bold and a size up so goals are easy to scan. */
export const GOAL_TITLE = "whitespace-pre-wrap text-base font-semibold leading-snug text-hive-ink";
/** The card around Goals and supports, and around Support strategies. */
export const PLAN_CARD = "border-hive-steel/60";

export function CodeBadges({ codes, empty }: { codes: readonly string[]; empty?: ReactNode }) {
  if (!codes.length) return empty ? <>{empty}</> : null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {codes.map((c) => (
        <span key={c} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-hive-ink">
          {c}
        </span>
      ))}
    </span>
  );
}

export function SupportLines({
  support,
  details,
  codes,
  noCodes,
  extra,
}: {
  support: string;
  details: string | null | undefined;
  codes: readonly string[];
  /** Shown instead of badges when the support has none of the agency's codes. */
  noCodes?: ReactNode;
  /** Other providers' badges and the like. */
  extra?: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="whitespace-pre-wrap text-sm">
        <span className="font-medium text-hive-ink">Support:</span>{" "}
        {support.trim() || <span className="italic text-muted-foreground">Not written yet</span>}{" "}
        <CodeBadges codes={codes} empty={noCodes} /> {extra}
      </p>
      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
        <span className="font-medium">Support details:</span> {details?.trim() || "None listed"}
      </p>
    </div>
  );
}
