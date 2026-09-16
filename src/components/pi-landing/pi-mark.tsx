import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { PI_PRODUCT_NAME, PI_PRODUCT_SHORT, PI_WORDMARK } from "@/lib/pi-landing";

export type PiMarkVariant = "inherit" | "cream" | "hero" | "gold";

/** The one brand gradient — antique gold to cream. Same stops on the homepage and in app chrome. */
export const PI_MARK_GRADIENT = { from: "#e8d5a0", to: "#b8985a" } as const;

/**
 * Squared π: three rects (x4 y4 w28 h5; x9 y9 w5 h23; x22 y9 w5 h23).
 * viewBox 0 0 36 36. Not a squiggly mathematical pi. Not a honeycomb.
 * `gold` is the product mark used everywhere the logo appears (PiBrand).
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
  const gid = `pi-mark-g-${rawId.replace(/:/g, "")}`;
  const gradient = variant === "hero" || variant === "gold";
  const fill = gradient ? `url(#${gid})` : variant === "cream" ? "#f3efe6" : "currentColor";
  const stops =
    variant === "gold"
      ? { from: PI_MARK_GRADIENT.from, to: PI_MARK_GRADIENT.to }
      : { from: "#fbf8f1", to: "#d9c98e" };

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
      {gradient ? (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stops.from} />
            <stop offset="1" stopColor={stops.to} />
          </linearGradient>
        </defs>
      ) : null}
      <rect x="4" y="4" width="28" height="5" fill={fill} />
      <rect x="9" y="9" width="5" height="23" fill={fill} />
      <rect x="22" y="9" width="5" height="23" fill={fill} />
    </svg>
  );
}

/**
 * Public homepage π. 30×30 viewBox, the same antique-gold gradient as
 * PiMark variant="gold" so the logo reads identically on every surface.
 */
export function PiHomepageMark({
  className,
  title,
  size = 30,
}: {
  className?: string;
  title?: string;
  size?: number;
}) {
  const rawId = useId();
  const gid = `pi-home-g-${rawId.replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 30 30"
      width={size}
      height={size}
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={cn("shrink-0", className)}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gid} x1="15" y1="3" x2="15" y2="27.5">
          <stop offset="0" stopColor={PI_MARK_GRADIENT.from} />
          <stop offset="1" stopColor={PI_MARK_GRADIENT.to} />
        </linearGradient>
      </defs>
      <rect x="2" y="3" width="26" height="5.5" rx="1" fill={`url(#${gid})`} />
      <rect x="6.5" y="8.5" width="5.5" height="19" rx="1" fill={`url(#${gid})`} />
      <rect x="18" y="8.5" width="5.5" height="19" rx="1" fill={`url(#${gid})`} />
    </svg>
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
      <PiMark variant="gold" width={markSize} height={markSize} className="mark" />
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
  /** chrome = cream on dusk; canvas = cream on dusk public pages. */
  tone?: "chrome" | "canvas";
  markClassName?: string;
  wordClassName?: string;
}) {
  const label = short ? PI_PRODUCT_SHORT : PI_WORDMARK;
  const inner = (
    <span
      className={cn(
        "inline-flex items-center gap-3",
        tone === "canvas" ? "text-[#f3efe6]" : "text-[#f3efe6]",
        className,
      )}
    >
      <PiMark
        className={cn(compact || short ? "h-7 w-7" : "h-8 w-8", "shrink-0", markClassName)}
        title={PI_PRODUCT_NAME}
      />
      <span
        className={cn(
          "font-sans font-medium uppercase tracking-[0.22em] text-[#f3efe6]",
          compact || short ? "text-[11px]" : "text-[12px] sm:text-[13px]",
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
