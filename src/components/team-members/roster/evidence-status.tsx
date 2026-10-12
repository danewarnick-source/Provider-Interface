import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  evidenceLabel,
  evidencePercent,
  type EvidenceLabelKind,
  type RosterRow,
} from "@/lib/team-members/roster";

const TONE: Record<EvidenceLabelKind, { bar: string; text: string; pill: string }> = {
  no_pack: {
    bar: "bg-muted-foreground/30",
    text: "text-muted-foreground",
    pill: "border-border bg-muted text-muted-foreground",
  },
  missing: {
    bar: "bg-destructive",
    text: "text-destructive",
    pill: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  review: {
    bar: "bg-denim-500",
    text: "text-denim-700 dark:text-denim-300",
    pill: "border-denim-500/30 bg-denim-500/10 text-denim-700 dark:text-denim-300",
  },
  due_soon: {
    bar: "bg-warning-500",
    text: "text-warning-700 dark:text-warning-300",
    pill: "border-warning-500/30 bg-warning-500/10 text-warning-700 dark:text-warning-300",
  },
  current: {
    bar: "bg-success-500",
    text: "text-success-700 dark:text-success-300",
    pill: "border-success-500/30 bg-success-500/10 text-success-700 dark:text-success-300",
  },
};

/** "No pack yet" links to the person's Team member file, where a pack is set up. */
function NoPackLink({ row, className }: { row: RosterRow; className?: string }) {
  return (
    <Link
      to="/dashboard/team-members/$staffId"
      params={{ staffId: row.userId }}
      search={{ tab: "file" }}
      className={cn("hover:underline", className)}
      onClick={(e) => e.stopPropagation()}
    >
      No pack yet
    </Link>
  );
}

/** Table cell: a thin bar (share of items on file) plus the status label. */
export function EvidenceBar({ row }: { row: RosterRow }) {
  const label = evidenceLabel(row.evidence);
  const tone = TONE[label.kind];
  const pct = evidencePercent(row.evidence);
  return (
    <div className="min-w-[120px]" data-testid="roster-evidence" data-kind={label.kind}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Evidence ${row.evidence.done} of ${row.evidence.total} on file`}
      >
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className={cn("mt-1 text-xs", tone.text)}>
        {label.kind === "no_pack" ? <NoPackLink row={row} /> : label.text}
      </div>
    </div>
  );
}

/** Card pill: same label, compact. */
export function EvidencePill({ row }: { row: RosterRow }) {
  const label = evidenceLabel(row.evidence);
  return (
    <span
      data-testid="roster-evidence"
      data-kind={label.kind}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONE[label.kind].pill,
      )}
    >
      {label.kind === "no_pack" ? <NoPackLink row={row} /> : label.text}
    </span>
  );
}
