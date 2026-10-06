// Due / overdue / satisfied banner for a document that has a deadline
// (SJD assessments).

import { cn } from "@/lib/utils";
import { fmtDate } from "./card-shell";
import type { DocRow } from "./code-document-cards";

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
      <div className="rounded-md border border-border p-2.5 text-sm text-muted-foreground">
        {missingHint}
      </div>
    );
  }
  const isOverdue = !doc && due.getTime() < Date.now();
  return (
    <div
      className={cn(
        "rounded-md border p-2.5 text-sm font-medium",
        doc
          ? "border-emerald-300/60 bg-emerald-50/40 text-emerald-800"
          : isOverdue
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-amber-300/60 bg-amber-50/40 text-amber-800",
      )}
    >
      {doc
        ? `Satisfied — deadline was ${fmtDate(due.toISOString().slice(0, 10))}`
        : isOverdue
          ? `Overdue — was due ${fmtDate(due.toISOString().slice(0, 10))} (${days} days)`
          : `Due ${fmtDate(due.toISOString().slice(0, 10))} — ${days} days`}
    </div>
  );
}
