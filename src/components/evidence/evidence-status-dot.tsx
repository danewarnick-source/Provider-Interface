import { Check, Clock, Minus, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, type EvidenceCellStatus } from "@/lib/evidence/status.ts";

const RING: Record<EvidenceCellStatus, string> = {
  done: "bg-acct text-accd ring-acctb",
  missing: "bg-danger-50 text-danger-700 ring-danger-200",
  awaiting_review: "bg-pt text-pri ring-pt2",
  sent_back: "bg-warning-50 text-warning-700 ring-warning-200",
  skipped: "bg-muted text-muted-foreground ring-border",
};

export function EvidenceStatusGlyph({ status }: { status: EvidenceCellStatus }) {
  const Icon =
    status === "done"
      ? Check
      : status === "awaiting_review"
        ? Clock
        : status === "sent_back"
          ? Undo2
          : Minus;
  return (
    <span
      title={statusLabel(status)}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full ring-1",
        RING[status],
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
    </span>
  );
}
