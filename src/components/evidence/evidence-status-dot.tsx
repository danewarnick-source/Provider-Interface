import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, type EvidenceCellStatus } from "@/lib/evidence/status.ts";

const RING: Record<EvidenceCellStatus, string> = {
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  missing: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function EvidenceStatusGlyph({ status }: { status: EvidenceCellStatus }) {
  const Icon = status === "done" ? Check : Minus;
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
