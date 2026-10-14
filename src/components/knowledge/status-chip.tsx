import { Badge } from "@/components/ui/badge";
import type { CellTone, Chip, ChipTone } from "@/lib/nectar/library/knowledge-view";
import { cn } from "@/lib/utils";

const CHIP_CLASS: Record<ChipTone, string> = {
  published: "bg-[var(--hive-ok-soft)] text-[var(--hive-ok-fg)]",
  draft: "bg-[var(--hive-info-soft)] text-[var(--hive-info-fg)]",
  past_review: "bg-amber-100 text-amber-900",
  missing: "bg-[var(--hive-danger-soft)] text-[var(--hive-danger-fg)]",
  archived: "bg-[var(--hive-muted-surface)] text-muted-foreground",
  state: "bg-violet-100 text-violet-900",
};

/** The status pill used across the Knowledge base (Published, Draft, Past review, ...). */
export function StatusChip({ chip, className }: { chip: Chip; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap rounded-full border-transparent px-2.5 py-1 text-xs font-semibold",
        CHIP_CLASS[chip.tone],
        className,
      )}
    >
      {chip.label}
    </Badge>
  );
}

const CELL_CLASS: Record<CellTone, string> = {
  ok: "text-[var(--hive-ok-fg)]",
  warn: "text-amber-800",
  muted: "text-muted-foreground",
};

/** A review status in words: "Reviewed Oct 3" (green), "Needs review" (amber), "Not for them". */
export function ReviewMark({
  mark,
  className,
}: {
  mark: { label: string; tone: CellTone };
  className?: string;
}) {
  return (
    <span className={cn("font-semibold", CELL_CLASS[mark.tone], className)}>{mark.label}</span>
  );
}
