import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PI_PRODUCT_NAME, PI_PRODUCT_SHORT, PI_WORDMARK } from "@/lib/pi-landing";
import { PiMark } from "@/components/pi-landing/pi-mark";

/**
 * chrome  = on the dark navy sidebar / top bar (cream wordmark)
 * canvas  = on a dark public/auth backdrop (cream wordmark)
 * on-light = on the pale canvas or a white card (ink wordmark)
 * The π mark itself is the same antique-gold gradient on every tone.
 */
export type PiBrandTone = "chrome" | "canvas" | "on-light";
export type PiBrandSize = "sm" | "md" | "lg";

const markSizes: Record<PiBrandSize, string> = {
  sm: "h-6 w-6",
  md: "h-[30px] w-[30px]",
  lg: "h-10 w-10",
};

/* Mirrors .pi-home-logo-pi on the public homepage: bold, 0.22em tracking, uppercase. */
const textSizes: Record<PiBrandSize, string> = {
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-[15px]",
};

const toneText: Record<PiBrandTone, string> = {
  chrome: "text-[var(--hive-chrome-text)]",
  canvas: "text-[var(--hive-chrome-text)]",
  "on-light": "text-[var(--hive-text)]",
};

const toneMuted: Record<PiBrandTone, string> = {
  chrome: "text-[var(--hive-chrome-text-muted)]",
  canvas: "text-[var(--hive-chrome-text-muted)]",
  "on-light": "text-[var(--hive-text-muted)]",
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
        variant="gold"
        className={cn(stacked ? "h-[38px] w-[38px]" : markSizes[size], "shrink-0", markClassName)}
        title={PI_PRODUCT_NAME}
      />
      {showText ? (
        stacked ? (
          <span className="flex min-w-0 flex-col gap-0.5 leading-none">
            <span
              className={cn(
                "font-sans text-[15px] font-bold uppercase tracking-[0.22em]",
                toneText[tone],
                textClassName,
              )}
            >
              {PI_PRODUCT_SHORT}
            </span>
            <span
              className={cn(
                "font-sans text-[10px] font-medium uppercase tracking-[0.2em]",
                toneMuted[tone],
              )}
            >
              {PI_WORDMARK}
            </span>
          </span>
        ) : (
          <span
            className={cn(
              "font-sans font-bold uppercase leading-none tracking-[0.22em]",
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
