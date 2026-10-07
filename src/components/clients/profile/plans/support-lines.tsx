// One support, labeled the same way everywhere (PCSP review, Goals and
// supports, Support strategies): "Support: <text> + code badges" and
// "Support details: <details>" (or "None listed").

import type { ReactNode } from "react";

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
