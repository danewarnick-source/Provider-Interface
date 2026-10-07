// Small shared pieces for client profile cards: info tile, label/value
// grid, status pill, empty state and a labeled input.

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TONE_TAG } from "@/components/profile-shell/tones";
import type { CardTone } from "./section-card";

/** White tile: small muted label, bold value, optional link. `warn` turns it amber. */
export function InfoTile({
  label,
  value,
  note,
  link,
  warn,
  testId,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  link?: { label: string; onClick: () => void };
  warn?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-4",
        warn ? "border-hive-gold bg-hive-gold-soft" : "border-hive-border bg-hive-surface",
      )}
      data-testid={testId}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-hive-ink">{value}</p>
      {note ? <p className="mt-0.5 text-xs font-medium text-hive-ink">{note}</p> : null}
      {link ? (
        <button
          type="button"
          onClick={link.onClick}
          className="mt-2 inline-flex min-h-6 items-center gap-1 text-xs font-medium text-[var(--hive-info-fg)] hover:underline max-md:min-h-11"
        >
          {link.label} <ArrowRight className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Label/value pairs: two columns, one on phones. */
export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid gap-x-6 gap-y-3 sm:grid-cols-2", className)}>{children}</dl>;
}

export function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children?: ReactNode;
  /** Spans both columns. */
  wide?: boolean;
}) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-hive-ink">
        {empty ? <span className="font-normal text-muted-foreground">—</span> : children}
      </dd>
    </div>
  );
}

/** Small pill in a tone. */
export function StatusTag({
  tone = "neutral",
  children,
  title,
  className,
  testId,
}: {
  tone?: CardTone;
  children: ReactNode;
  title?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_TAG[tone],
        className,
      )}
      data-testid={testId}
    >
      {children}
    </span>
  );
}

/** One sentence plus the button that fixes it. */
export function EmptyState({
  children,
  action,
  testId,
}: {
  children: ReactNode;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-hive-border bg-[var(--hive-muted-surface)]/50 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between max-md:[&_button]:min-h-11"
      data-testid={testId}
    >
      <p>{children}</p>
      {action}
    </div>
  );
}

export function LabeledInput({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
