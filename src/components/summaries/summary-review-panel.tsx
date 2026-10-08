// Nectar as a helper next to the progress summary's text boxes. Each box
// has its own "Draft with Nectar"; the rewrite comes back as a marked
// suggestion with the changes shown (added words green, removed words
// struck through red), Accept, and an x. After Accept the box shows Undo.
// Reminders are one small list; each has an x. None of it blocks Finalize.

import { useMemo, useState } from "react";
import { Loader2, Sparkles, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wordDiff } from "@/lib/progress-summary-diff";
import type { FieldKey, FieldSuggestion, Reminder } from "@/lib/progress-summary-review";

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

function SuggestionCard({
  suggestion,
  current,
  busy,
  onAccept,
  onHide,
}: {
  suggestion: FieldSuggestion;
  current: string;
  busy: boolean;
  onAccept: () => void;
  onHide: () => void;
}) {
  const [original, setOriginal] = useState(false);
  const parts = useMemo(() => wordDiff(current, suggestion.text), [current, suggestion.text]);
  return (
    <div
      className="relative space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 pr-8 text-xs"
      data-testid="summary-suggestion"
    >
      <button type="button" className={hideButton} aria-label="Hide suggestion" onClick={onHide}>
        <X className="size-3.5" />
      </button>
      <p className="flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-100">
        <Sparkles className="size-3.5" /> Nectar draft
      </p>
      <p className="whitespace-pre-wrap text-sm">
        {parts.map((p, i) =>
          p.kind === "same" ? (
            <span key={i}>{p.text}</span>
          ) : p.kind === "add" ? (
            <span key={i} className="rounded-sm bg-green-100 dark:bg-green-900/40">
              {p.text}
            </span>
          ) : (
            <span key={i} className="rounded-sm bg-red-100 line-through dark:bg-red-900/40">
              {p.text}
            </span>
          ),
        )}
      </p>
      {original ? (
        <p className="whitespace-pre-wrap rounded bg-muted/50 p-1.5 text-muted-foreground">
          {current || "(empty)"}
        </p>
      ) : null}
      {suggestion.drops.length ? (
        <p className="font-medium text-hive-danger">
          Drops something you wrote: {suggestion.drops.join(", ")}. Copy what you want instead.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {!suggestion.drops.length ? (
          <Button type="button" size="sm" className="h-8" disabled={busy} onClick={onAccept}>
            Accept
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => setOriginal((v) => !v)}
        >
          {original ? "Hide original" : "Show original"}
        </Button>
      </div>
    </div>
  );
}

export interface BoxToolsProps {
  field: FieldKey;
  /** The text in the box now. */
  current: string;
  suggestion: FieldSuggestion | null;
  canUndo: boolean;
  /** Whether this box can be drafted (has text, or a goal with records). */
  canDraft: boolean;
  /** This box is being drafted right now. */
  drafting: boolean;
  busy: boolean;
  onDraft: (field: FieldKey) => void;
  onAccept: (field: FieldKey) => void;
  onUndo: (field: FieldKey) => void;
  onHideSuggestion: (suggestion: FieldSuggestion) => void;
}

/** Draft with Nectar, Undo and the suggestion card for one text box. */
export function BoxTools({
  field,
  current,
  suggestion,
  canUndo,
  canDraft,
  drafting,
  busy,
  onDraft,
  onAccept,
  onUndo,
  onHideSuggestion,
}: BoxToolsProps) {
  return (
    <div className="space-y-1.5" data-testid={`summary-box-tools-${field}`}>
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
          >
            <Undo2 className="mr-1 size-3.5" /> Undo
          </Button>
        ) : null}
      </div>
      {suggestion ? (
        <SuggestionCard
          suggestion={suggestion}
          current={current}
          busy={busy}
          onAccept={() => onAccept(field)}
          onHide={() => onHideSuggestion(suggestion)}
        />
      ) : null}
    </div>
  );
}
