import { cn } from "@/lib/utils";
import { PiBrand } from "@/components/brand/pi-brand";
import { PiMark } from "@/components/pi-landing/pi-mark";

/** @deprecated Prefer PiBrand — kept for gradual migration. */
export function HiveMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return <PiMark className={className} title={title} />;
}

/** Canonical chrome wordmark: π + PI. */
export function HiveWordmark({
  className,
  markClassName,
  textClassName,
  to,
  tone = "chrome",
  size = "md",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  to?: "/";
  tone?: "chrome" | "canvas" | "on-light";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <PiBrand
      className={className}
      markClassName={markClassName}
      textClassName={textClassName}
      to={to}
      tone={tone}
      size={size}
    />
  );
}

export { PiBrand } from "@/components/brand/pi-brand";
