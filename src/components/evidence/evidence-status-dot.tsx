import { AlertTriangle, Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, type EvidenceCellStatus } from "@/lib/evidence/status.ts";

const DOT: Record<EvidenceCellStatus, string> = {
  done: "bg-emerald-500",
  expiring: "bg-amber-400",
  missing: "bg-rose-500",
};

const RING: Record<EvidenceCellStatus, string> = {
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  expiring: "bg-amber-50 text-amber-800 ring-amber-200",
  missing: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function EvidenceStatusDot({
  status,
  className,
}: {
  status: EvidenceCellStatus;
  className?: string;
}) {
  return (
    <span
      title={statusLabel(status)}
      className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT[status], className)}
    />
  );
}

export function EvidenceStatusGlyph({ status }: { status: EvidenceCellStatus }) {
  const Icon = status === "done" ? Check : status === "expiring" ? AlertTriangle : Minus;
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

export function EvidenceStatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <EvidenceStatusDot status="done" /> Done
      </span>
      <span className="inline-flex items-center gap-1.5">
        <EvidenceStatusDot status="expiring" /> Expiring soon
      </span>
      <span className="inline-flex items-center gap-1.5">
        <EvidenceStatusDot status="missing" /> Missing / needs attention
      </span>
    </div>
  );
}
