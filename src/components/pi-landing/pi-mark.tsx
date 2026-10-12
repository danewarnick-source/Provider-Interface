import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PI_PRODUCT_NAME, PI_PRODUCT_SHORT, PI_WORDMARK } from "@/lib/pi-landing";

export type PiMarkVariant = "inherit" | "brand";

/** Denim brand mark: navy tile (#274C77 → #1B3350) with green π bars. Same on every surface. */
export const PI_MARK_COLORS = {
  tileFrom: "#274C77",
  tileTo: "#1B3350",
  barFrom: "#CDEBC0",
  barTo: "#4D9F3A",
} as const;

/**
 * Squared π: three rects (x4 y5 w28 h5; x9 y10 w5 h22; x22 y10 w5 h22).
 * viewBox 0 0 36 36. Not a squiggly mathematical pi. Not a honeycomb.
 * `brand` is the product mark used everywhere the logo appears (PiBrand): a
 * rounded navy tile with green bars.
 * `inherit` is for icon-sized uses that follow the surrounding text color.
 * Never pair this mark with a NECTAR wordmark in chrome.
 */
export function PiMark({
  className,
  title,
  variant = "inherit",
  width,
  height,
}: {
  className?: string;
  title?: string;
  variant?: PiMarkVariant;
  width?: number;
  height?: number;
}) {
  const rawId = useId();
  const base = `pi-mark-${rawId.replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 36 36"
      width={width}
      height={height}
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={cn("text-current", className)}
    >
      {title ? <title>{title}</title> : null}
      {variant === "brand" ? (
        <>
          <defs>
            <linearGradient id={`${base}-t`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={PI_MARK_COLORS.tileFrom} />
              <stop offset="1" stopColor={PI_MARK_COLORS.tileTo} />
            </linearGradient>
            <linearGradient id={`${base}-b`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={PI_MARK_COLORS.barFrom} />
              <stop offset="1" stopColor={PI_MARK_COLORS.barTo} />
            </linearGradient>
          </defs>
          <rect width="36" height="36" rx="9" fill={`url(#${base}-t)`} />
          <g transform="translate(18 18.6) scale(.62) translate(-18 -18.5)" fill={`url(#${base}-b)`}>
            <rect x="4" y="5" width="28" height="5" rx=".8" />
            <rect x="9" y="10" width="5" height="22" rx=".8" />
            <rect x="22" y="10" width="5" height="22" rx=".8" />
          </g>
        </>
      ) : (
        <g fill="currentColor">
          <rect x="4" y="4" width="28" height="5" />
          <rect x="9" y="9" width="5" height="23" />
          <rect x="22" y="9" width="5" height="23" />
        </g>
      )}
    </svg>
  );
}

/** Public homepage π — the same Denim brand mark, sized for the header. */
export function PiHomepageMark({
  className,
  title,
  size = 30,
}: {
  className?: string;
  title?: string;
  size?: number;
}) {
  return (
    <PiMark
      variant="brand"
      width={size}
      height={size}
      title={title}
      className={cn("shrink-0", className)}
    />
  );
}

export function PiHomeLockup({
  to = "/",
  markSize = 30,
}: {
  to?: "/";
  markSize?: number;
}) {
  return (
    <Link to={to} hash="" className="pi-home-logo" aria-label={PI_PRODUCT_NAME}>
      <PiHomepageMark size={markSize} className="pi-home-logo-mark" />
      <span className="pi-home-logo-name">
        <span className="pi-home-logo-pi">{PI_PRODUCT_SHORT}</span>
        <span className="pi-home-logo-word">{PI_WORDMARK}</span>
      </span>
    </Link>
  );
}

export function PiBrandLockup({
  to = "/",
  markSize = 26,
}: {
  to?: "/";
  markSize?: number;
}) {
  return (
    <Link to={to} className="logo" aria-label={PI_PRODUCT_NAME}>
      <PiMark variant="brand" width={markSize} height={markSize} className="mark" />
      <div className="name">
        {PI_PRODUCT_SHORT}
        <small>{PI_PRODUCT_NAME}</small>
      </div>
    </Link>
  );
}

export function PiWordmark({
  className,
  compact = false,
  short = true,
  to,
  tone = "chrome",
  markClassName,
  wordClassName,
}: {
  className?: string;
  compact?: boolean;
  /** Compact chrome: π + PI. Full marketing: π + PROVIDER INTERFACE. Defaults true in app chrome. */
  short?: boolean;
  to?: "/";
  /** chrome = white on the navy sidebar; canvas = white on a navy band. */
  tone?: "chrome" | "canvas";
  markClassName?: string;
  wordClassName?: string;
}) {
  const label = short ? PI_PRODUCT_SHORT : PI_WORDMARK;
  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-3",
        "text-white",
        className,
      )}
    >
      <PiMark
        variant="brand"
        className={cn(compact || short ? "h-7 w-7" : "h-8 w-8", "shrink-0", markClassName)}
        title={PI_PRODUCT_NAME}
      />
      <span
        className={cn(
          "font-display font-bold tracking-[-0.02em] text-white",
          compact || short ? "text-[14px]" : "text-[15.5px]",
          wordClassName,
        )}
      >
        {label}
      </span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center" aria-label={PI_PRODUCT_NAME}>
        {inner}
      </Link>
    );
  }

  return inner;
}
