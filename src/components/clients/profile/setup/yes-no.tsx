// One short setup question with Yes / No. The follow-up (what to add) opens
// under it on Yes; `noNote` says what No does ("Medications are hidden").

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function YesNo({
  question,
  value,
  onChange,
  disabled,
  noNote,
  children,
  testId,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  question: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  noNote?: string;
  /** Shown when the answer is Yes. */
  children?: ReactNode;
  testId?: string;
  yesLabel?: string;
  noLabel?: string;
}) {
  const option = (v: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={value === v}
      disabled={disabled}
      onClick={() => onChange(v)}
      className={cn(
        "min-h-11 min-w-16 rounded-full border px-4 text-sm",
        value === v
          ? "border-hive-ink bg-hive-gold-soft font-medium text-hive-ink"
          : "border-hive-border bg-hive-surface text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-3 border-b border-hive-border py-4 last:border-b-0" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-hive-ink">{question}</p>
        <div className="flex gap-2" role="group" aria-label={question}>
          {option(true, yesLabel)}
          {option(false, noLabel)}
        </div>
      </div>
      {value === true && children ? <div>{children}</div> : null}
      {value === false && noNote ? <p className="text-xs text-muted-foreground">{noNote}</p> : null}
    </div>
  );
}
