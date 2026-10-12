import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PI_PRODUCT_NAME, PI_PRODUCT_SHORT, PI_WORDMARK } from "@/lib/pi-landing";
import { PiMark } from "@/components/pi-landing/pi-mark";

/**
 * chrome  = on the navy sidebar (white wordmark)
 * canvas  = on a navy public/auth band (white wordmark)
 * on-light = on the pale canvas, glass bar or a white card (--pri wordmark)
 * The π mark itself is the same Denim tile (navy + green) on every tone.
 */
export type PiBrandTone = "chrome" | "canvas" | "on-light";
export type PiBrandSize = "sm" | "md" | "lg";

const markSizes: Record<PiBrandSize, string> = {
  sm: "h-6 w-6",
  md: "h-[30px] w-[30px]",
  lg: "h-10 w-10",
};

/* Denim wordmark: Manrope 700, -0.02em tracking. */
const textSizes: Record<PiBrandSize, string> = {
  sm: "text-[14px]",
  md: "text-[15.5px]",
  lg: "text-[18px]",
};

const toneText: Record<PiBrandTone, string> = {
  chrome: "text-white",
  canvas: "text-white",
  "on-light": "text-pri",
};

const toneMuted: Record<PiBrandTone, string> = {
  chrome: "text-[var(--hive-chrome-text-muted)]",
  canvas: "text-[var(--hive-chrome-text-muted)]",
  "on-light": "text-muted-foreground",
};

/**
 * Canonical PI brand lockup: π mark + "PI" wordmark.
 * `stacked` is option 4 — the logged-in sidebar: 38px mark, "PI", then
 * "PROVIDER INTERFACE" in smaller letters. Fits the 64px header band.
 */
export function PiBrand({
  className,
  tone = "chrome",
  size = "md",
  to,
  /** When false, render mark only (e.g. nested inside an existing wordmark). */
  showText = true,
  /** π + PI + PROVIDER INTERFACE, the logged-in sidebar lockup. */
  stacked = false,
  markClassName,
  textClassName,
}: {
  className?: string;
  tone?: PiBrandTone;
  size?: PiBrandSize;
  to?: "/" | "/dashboard";
  showText?: boolean;
  stacked?: boolean;
  markClassName?: string;
  textClassName?: string;
}) {
  const inner = (
    <span className={cn("inline-flex min-w-0 items-center gap-3", toneText[tone], className)}>
      <PiMark
        variant="brand"
        className={cn(stacked ? "h-[38px] w-[38px]" : markSizes[size], "shrink-0", markClassName)}
        title={PI_PRODUCT_NAME}
      />
      {showText ? (
        stacked ? (
          <span className="flex min-w-0 flex-col gap-0.5 leading-none">
            <span
              className={cn(
                "font-display text-[15.5px] font-bold tracking-[-0.02em]",
                toneText[tone],
                textClassName,
              )}
            >
              {PI_PRODUCT_SHORT}
            </span>
            <span
              className={cn(
                "font-sans text-[10px] font-semibold uppercase tracking-[0.12em]",
                toneMuted[tone],
              )}
            >
              {PI_WORDMARK}
            </span>
          </span>
        ) : (
          <span
            className={cn(
              "font-display font-bold leading-none tracking-[-0.02em]",
              textSizes[size],
              toneText[tone],
              textClassName,
            )}
          >
            {PI_PRODUCT_SHORT}
          </span>
        )
      ) : null}
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex min-w-0 items-center" aria-label={PI_PRODUCT_NAME}>
        {inner}
      </Link>
    );
  }

  return inner;
}
