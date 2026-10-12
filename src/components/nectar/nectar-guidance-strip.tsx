import { Sparkles } from "lucide-react";
import { PiMark } from "@/components/pi-landing/pi-mark";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Subtle frosted guidance strip used at the top of any tab where NECTAR
 * surfaces "what this is for / what needs attention" copy. Amber is reserved
 * for actionable highlights (e.g. counts that demand review).
 */
export function NectarGuidanceStrip({
  title,
  message,
  highlight,
  actionLabel,
  onAction,
  className,
}: {
  title: string;
  message: ReactNode;
  /** Short info call-out (e.g. "3 unassigned shifts"). */
  highlight?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-[var(--denim-r)] border border-pt2 bg-pt/60 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-pt/50",
        "sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="relative grid h-9 w-9 place-items-center">
          <PiMark className="absolute inset-0 h-9 w-9 text-primary/30" />
          <Sparkles className="relative h-4 w-4 text-acc" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accd">
            NECTAR
          </span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 text-xs text-muted-foreground sm:text-[13px]">
        {message}
      </div>

      {highlight && (
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-pt2 bg-paper px-2.5 py-1 text-[11px] font-semibold text-pri"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-acc" />
          {highlight}
        </span>
      )}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-pt2 bg-paper px-3 py-1.5 text-xs font-semibold text-pri transition hover:bg-pt"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
