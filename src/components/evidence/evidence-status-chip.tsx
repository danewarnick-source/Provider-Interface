import { cn } from "@/lib/utils";
import type { EvidenceMatrixChip, EvidenceMatrixChipKind } from "@/lib/evidence/status.ts";

const CHIP: Record<EvidenceMatrixChipKind, string> = {
  complete: "bg-[var(--hive-ok-soft)] text-[var(--hive-ok-fg)]",
  due: "bg-[var(--hive-gold-soft)] text-[#6b5420]",
  missing: "bg-[var(--hive-danger-soft)] text-[var(--hive-danger-fg)]",
  review: "bg-[var(--hive-info-soft)] text-[var(--hive-info-fg)]",
  add: "border border-dashed border-[var(--hive-border)] bg-[var(--hive-muted-surface)] text-[var(--hive-steel)]",
  na: "border border-dashed border-[var(--hive-border)] bg-[var(--hive-muted-surface)] text-[var(--hive-steel)]",
};

const ICO: Record<EvidenceMatrixChipKind, { mark: string; fill: string }> = {
  complete: { mark: "✓", fill: "bg-[var(--hive-ok)]" },
  due: { mark: "·", fill: "bg-[var(--hive-gold)]" },
  missing: { mark: "!", fill: "bg-[var(--hive-danger)]" },
  review: { mark: "o", fill: "bg-[var(--hive-info)]" },
  add: { mark: "+", fill: "bg-[var(--hive-steel)]" },
  na: { mark: "–", fill: "bg-[var(--hive-steel)]" },
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
    "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[9px] px-2.5 text-xs font-semibold",
    CHIP[chip.kind],
    interactive && "cursor-pointer hover:brightness-[0.98]",
  );
  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[9px] font-extrabold leading-none text-white",
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
