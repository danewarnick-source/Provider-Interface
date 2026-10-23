// Due / overdue / satisfied banner for a document that has a deadline
// (SJD assessments).

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/clients/dates";
import type { DocRow } from "./code-document-cards";

/** Banner colors: satisfied (ok), overdue (danger) or due (gold). */
export function deadlineToneClass(satisfied: boolean, overdue: boolean): string {
  return satisfied
    ? "border-[var(--hive-ok)]/30 bg-[var(--hive-ok-soft)] text-[var(--hive-ok-fg)]"
    : overdue
      ? "border-[var(--hive-danger)]/30 bg-[var(--hive-danger-soft)] text-[var(--hive-danger-fg)]"
      : "border-hive-gold/50 bg-hive-gold-soft text-hive-ink";
}

/** Due / overdue / satisfied line for a document with a deadline. */
export function DeadlineBanner({
  due,
  doc,
  days,
  missingHint,
}: {
  due: Date | null;
  doc: DocRow | undefined;
  days: number;
  missingHint: string;
}) {
  if (!due) {
    return (
      <div className="rounded-xl border border-hive-border p-3 text-sm text-muted-foreground">
        {missingHint}
      </div>
    );
  }
  const isOverdue = !doc && due.getTime() < Date.now();
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-sm font-medium",
        deadlineToneClass(!!doc, isOverdue),
      )}
    >
      {doc
        ? `Satisfied — deadline was ${formatDate(due.toISOString().slice(0, 10))}`
        : isOverdue
          ? `Overdue — was due ${formatDate(due.toISOString().slice(0, 10))} (${days} days)`
          : `Due ${formatDate(due.toISOString().slice(0, 10))} — ${days} days`}
    </div>
  );
}
