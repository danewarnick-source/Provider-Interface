import { Check, Clock, Minus, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, type EvidenceCellStatus } from "@/lib/evidence/status.ts";

const RING: Record<EvidenceCellStatus, string> = {
  done: "bg-success-50 text-success-700 ring-success-200",
  missing: "bg-danger-50 text-danger-700 ring-danger-200",
  awaiting_review: "bg-denim-50 text-denim-700 ring-denim-200",
  sent_back: "bg-warning-50 text-warning-800 ring-warning-200",
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
