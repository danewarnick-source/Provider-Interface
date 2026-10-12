import { cn } from "@/lib/utils";
import type { EvidenceMatrixChip, EvidenceMatrixChipKind } from "@/lib/evidence/status.ts";

const CHIP: Record<EvidenceMatrixChipKind, string> = {
  complete: "bg-acct text-accd ring-1 ring-acctb",
  due: "bg-warning-50 text-warning-700 ring-1 ring-warning-200",
  missing: "bg-danger-50 text-danger-700 ring-1 ring-danger-200",
  review: "bg-pt text-pri",
  add: "border border-dashed border-[var(--hive-border)] bg-[var(--hive-muted-surface)] text-[var(--hive-steel)]",
  open: "bg-[var(--hive-muted-surface)] text-[var(--hive-text)]",
  na: "border border-dashed border-[var(--hive-border)] bg-[var(--hive-muted-surface)] text-[var(--hive-steel)]",
  awaiting_review: "bg-pt text-pri",
  sent_back: "bg-warning-50 text-warning-700 ring-1 ring-warning-200",
  skipped:
    "border border-dashed border-[var(--hive-border)] bg-[var(--hive-muted-surface)] text-[var(--hive-steel)]",
};

const ICO: Record<EvidenceMatrixChipKind, { mark: string; fill: string }> = {
  complete: { mark: "✓", fill: "bg-[var(--hive-ok)]" },
  due: { mark: "·", fill: "bg-warning-500" },
  missing: { mark: "·", fill: "bg-[var(--hive-danger)]" },
  review: { mark: "o", fill: "bg-[var(--hive-info)]" },
  add: { mark: "+", fill: "bg-[var(--hive-steel)]" },
  open: { mark: "·", fill: "bg-[var(--hive-steel)]" },
  na: { mark: "–", fill: "bg-[var(--hive-steel)]" },
  awaiting_review: { mark: "o", fill: "bg-[var(--hive-info)]" },
  sent_back: { mark: "!", fill: "bg-warning-500" },
  skipped: { mark: "–", fill: "bg-[var(--hive-steel)]" },
};

export function EvidenceStatusChip({
  chip,
  interactive,
  onClick,
  ariaLabel,
}: {
  chip: EvidenceMatrixChip;
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel: string;
}) {
  const ico = ICO[chip.kind];
  const className = cn(
    "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold",
    CHIP[chip.kind],
    interactive && "cursor-pointer hover:brightness-[0.98]",
  );
  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[9px] font-bold leading-none text-white",
          ico.fill,
        )}
      >
        {ico.mark}
      </span>
      {chip.label}
    </>
  );

  if (!interactive) {
    return (
      <span className={className} aria-label={ariaLabel}>
        {inner}
      </span>
    );
  }

  return (
    <button type="button" className={className} aria-label={ariaLabel} onClick={onClick}>
      {inner}
    </button>
  );
}
