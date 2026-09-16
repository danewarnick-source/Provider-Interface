import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PI_PRODUCT_NAME, PI_PRODUCT_SHORT } from "@/lib/pi-landing";
import { PiMark, type PiMarkVariant } from "@/components/pi-landing/pi-mark";

export type PiBrandTone = "chrome" | "canvas" | "on-light";
export type PiBrandSize = "sm" | "md" | "lg";

const markSizes: Record<PiBrandSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-9 w-9",
};

const textSizes: Record<PiBrandSize, string> = {
  sm: "text-[11px] tracking-[0.18em]",
  md: "text-xs tracking-[0.2em]",
  lg: "text-sm tracking-[0.22em]",
};

const toneClasses: Record<PiBrandTone, { wrap: string; text: string; mark: PiMarkVariant }> = {
  chrome: {
    wrap: "text-[var(--hive-chrome-text)]",
    text: "text-[var(--hive-chrome-text)]",
    mark: "cream",
  },
  canvas: {
    wrap: "text-[var(--hive-chrome-text)]",
    text: "text-[var(--hive-chrome-text)]",
    mark: "cream",
  },
  "on-light": {
    wrap: "text-[var(--hive-text)]",
    text: "text-[var(--hive-text)]",
    mark: "inherit",
  },
};

/**
 * Canonical PI brand lockup: π mark + "PI" wordmark.
 * Use everywhere the product logo appears in the UI (headers, sidebars, auth).
 * Favicons remain icon-only.
 */
export function PiBrand({
  className,
  tone = "chrome",
  size = "md",
  to,
  /** When false, render mark only (e.g. nested inside an existing wordmark). */
  showText = true,
  markClassName,
  textClassName,
}: {
  className?: string;
  tone?: PiBrandTone;
  size?: PiBrandSize;
  to?: "/";
  showText?: boolean;
  markClassName?: string;
  textClassName?: string;
}) {
  const toneStyle = toneClasses[tone];

  const inner = (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2",
        toneStyle.wrap,
        className,
      )}
    >
      <PiMark
        variant={toneStyle.mark}
        className={cn(markSizes[size], "shrink-0", markClassName)}
        title={PI_PRODUCT_NAME}
      />
      {showText ? (
        <span
          className={cn(
            "font-sans font-semibold uppercase",
            textSizes[size],
            toneStyle.text,
            textClassName,
          )}
        >
          {PI_PRODUCT_SHORT}
        </span>
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
