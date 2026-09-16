import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page container — consistent max-width, horizontal padding, vertical rhythm.
 * Use inside dashboard main, public auth cards, and standalone error pages.
 */
export function PageShell({
  children,
  className,
  width = "default",
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  width?: "narrow" | "default" | "wide" | "full";
  padding?: boolean;
}) {
  const widthClass =
    width === "narrow"
      ? "max-w-[var(--page-width-narrow)]"
      : width === "wide"
        ? "max-w-[var(--page-width-wide)]"
        : width === "full"
          ? "max-w-none"
          : "max-w-[var(--page-width-default)]";

  return (
    <div
      className={cn(
        "mx-auto w-full",
        widthClass,
        padding && "px-[var(--page-padding-x)] py-[var(--page-padding-y)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Standard page header — title, optional description, actions on the right.
 * On mobile, actions stack below the title block.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  dense = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        dense ? "mb-4" : "mb-6",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1
          className={cn(
            "font-semibold leading-tight tracking-tight text-foreground",
            dense ? "text-lg" : "text-xl sm:text-2xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * Dialog / drawer footer with Cancel before primary (mobile: primary on bottom).
 */
export function FormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
