import type { ComponentType, ReactNode } from "react";
import { PiMark } from "@/components/pi-landing/pi-mark";

/**
 * Crisp page header for staff app pages — eyebrow + title + subhead.
 * Default mark is the cream π, not a honeycomb.
 *
 * Mobile-first: title scales from text-xl → text-2xl at sm.
 */
function DefaultEyebrowMark({ className }: { className?: string; strokeWidth?: number }) {
  return <PiMark className={className} title="Provider Interface" />;
}

export function StaffPageHeader({
  eyebrow,
  eyebrowIcon: EyebrowIcon = DefaultEyebrowMark,
  title,
  subtitle,
  actions,
  variant = "default",
}: {
  eyebrow: string;
  eyebrowIcon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** "nectar" tints the eyebrow with the NECTAR violet/amber treatment. */
  variant?: "default" | "nectar";
}) {
  const eyebrowColor =
    variant === "nectar"
      ? "text-[oklch(var(--accent-3))]"
      : "text-accent";

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <div
          className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${eyebrowColor}`}
        >
          <EyebrowIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="truncate">{eyebrow}</span>
        </div>
        {/* The page title already appears in the top bar (mobile and desktop) — keep it for a11y only. */}
        <h1 className="sr-only">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
