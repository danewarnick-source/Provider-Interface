// Nectar as a helper next to the progress summary's text boxes. Each box
// has its own "Draft with Nectar", which writes Nectar's text straight into
// the box; Undo under the box then puts back exactly what was there. A draft
// that wasn't used leaves the box as it was, with a one-line note.
// Reminders are one small list; each has an x. None of it blocks Finalize.

import { Loader2, Sparkles, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FieldKey, Reminder } from "@/lib/progress-summary-review";

const hideButton =
  "absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground";

export function RemindersList({
  reminders,
  onHide,
}: {
  reminders: Reminder[];
  onHide: (key: string) => void;
}) {
  if (!reminders.length) return null;
  return (
    <div
      className="space-y-1 rounded-md border bg-muted/30 p-2 text-xs"
      data-testid="summary-reminders"
    >
      <p className="font-semibold text-muted-foreground">Reminders</p>
      <ul className="space-y-1">
        {reminders.map((r) => (
          <li key={r.key} className="relative rounded bg-background py-1 pl-2 pr-8">
            {r.text}
            <button
              type="button"
              className={hideButton}
              aria-label="Hide reminder"
              onClick={() => onHide(r.key)}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface BoxToolsProps {
  field: FieldKey;
  canUndo: boolean;
  /** Whether this box can be drafted (has text or records). */
  canDraft: boolean;
  /** This box is being drafted right now. */
  drafting: boolean;
  busy: boolean;
  /** Why the last draft for this box wasn't used, in one line. */
  note?: string;
  onDraft: (field: FieldKey) => void;
  onUndo: (field: FieldKey) => void;
}

/** Draft with Nectar, Undo and the one-line note for one text box. */
export function BoxTools({ field, canUndo, canDraft, drafting, busy, note, onDraft, onUndo }: BoxToolsProps) {
  return (
    <div className="space-y-1" data-testid={`summary-box-tools-${field}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={busy || !canDraft}
          onClick={() => onDraft(field)}
        >
          {drafting ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1 size-3.5" />
          )}
          Draft with Nectar
        </Button>
        {canUndo ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={busy}
            onClick={() => onUndo(field)}
            data-testid={`summary-undo-${field}`}
          >
            <Undo2 className="mr-1 size-3.5" /> Undo
          </Button>
        ) : null}
      </div>
      {note ? (
        <p className="text-xs text-muted-foreground" data-testid={`summary-draft-note-${field}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
