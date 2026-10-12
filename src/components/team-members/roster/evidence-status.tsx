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
    bar: "bg-pt2",
    text: "text-muted-foreground",
    pill: "border-line bg-pt0 text-muted-foreground",
  },
  missing: {
    bar: "bg-danger-600",
    text: "text-danger-700",
    pill: "border-danger-200 bg-danger-50 text-danger-700",
  },
  review: {
    bar: "bg-pri",
    text: "text-pri",
    pill: "border-pt2 bg-pt text-pri",
  },
  due_soon: {
    bar: "bg-warning-500",
    text: "text-warning-700",
    pill: "border-warning-200 bg-warning-50 text-warning-700",
  },
  current: {
    bar: "bg-acc",
    text: "text-accd",
    pill: "border-acctb bg-acct text-accd",
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
        className="h-1.5 w-full overflow-hidden rounded-full bg-pt"
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
