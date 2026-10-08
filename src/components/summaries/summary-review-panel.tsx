// Nectar's review next to one field of the progress summary, the way the
// clock-out shift note shows its Nectar triggers: each finding is amber
// until it is fixed (it disappears) or kept with "Keep as is" (green, with
// who and when); missing required content needs a short reason. Nectar's
// suggested rewrite of the field is a marked draft: Accept or Keep mine.

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MIN_DISMISS_REASON,
  canDismiss,
  fieldGoalId,
  type Dismissal,
  type FieldKey,
  type FieldSuggestion,
  type SummaryFinding,
} from "@/lib/progress-summary-review";

export interface FieldReviewProps {
  field: FieldKey;
  findings: SummaryFinding[];
  dismissals: Record<string, Dismissal>;
  suggestion: FieldSuggestion | null;
  goalNames: Record<string, string>;
  busy: boolean;
  onAccept: (field: FieldKey) => void;
  onKeepMine: (field: FieldKey) => void;
  onDismiss: (key: string, reason: string | null) => void;
}

const fieldName = (f: FieldKey, goalNames: Record<string, string>) => {
  const id = fieldGoalId(f);
  if (id !== null) return goalNames[id] ?? "a goal";
  return f === "general" ? "General notes" : f === "incidentNotes" ? "Incident notes" : "Incident";
};

function FindingRow({
  f,
  dismissal,
  goalNames,
  busy,
  onDismiss,
}: {
  f: SummaryFinding;
  dismissal: Dismissal | undefined;
  goalNames: Record<string, string>;
  busy: boolean;
  onDismiss: (key: string, reason: string | null) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const kept = !!dismissal;
  return (
    <div
      className={`rounded-md border p-2 text-xs ${
        kept
          ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
          : "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
      }`}
      data-testid="summary-finding"
    >
      <div className="flex items-start gap-1.5">
        {kept ? (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        ) : (
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">
            {f.message}
            {f.cite ? <span className="font-normal text-muted-foreground"> ({f.cite})</span> : null}
          </p>
          {f.quote && f.source === "nectar" ? (
            <p className="text-muted-foreground">“{f.quote}”</p>
          ) : null}
          {f.moveTo ? <p>Move to {goalNames[f.moveTo] ?? "that goal"}.</p> : null}
          {f.suggestion ? <p className="text-muted-foreground">{f.suggestion}</p> : null}
          {kept ? (
            <p className="text-emerald-700 dark:text-emerald-300">
              Kept as is by {dismissal.byName ?? "a team member"},{" "}
              {new Date(dismissal.at).toLocaleDateString()}
              {dismissal.reason ? ` — ${dismissal.reason}` : ""}.
            </p>
          ) : asking ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={f.needsReason ? "Why keep it? (required)" : "Why keep it? (optional)"}
                className="h-8 min-w-0 flex-1 text-xs"
                maxLength={500}
              />
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={busy || !canDismiss(f, reason)}
                onClick={() => onDismiss(f.key, reason.trim() || null)}
              >
                Keep as is
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => setAsking(false)}
              >
                Cancel
              </Button>
              {f.needsReason && !canDismiss(f, reason) ? (
                <p className="w-full text-muted-foreground">
                  At least {MIN_DISMISS_REASON} characters.
                </p>
              ) : null}
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => setAsking(true)}
            >
              Keep as is
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FieldReview({
  field,
  findings,
  dismissals,
  suggestion,
  goalNames,
  busy,
  onAccept,
  onKeepMine,
  onDismiss,
}: FieldReviewProps) {
  const pending = findings.filter((f) => f.onSuggestion);
  const shown = findings.filter((f) => !f.onSuggestion);
  if (!shown.length && !suggestion) return null;
  return (
    <div className="space-y-1.5" data-testid={`summary-review-${field}`}>
      {shown.map((f) => (
        <FindingRow
          key={f.key}
          f={f}
          dismissal={dismissals[f.key]}
          goalNames={goalNames}
          busy={busy}
          onDismiss={onDismiss}
        />
      ))}
      {suggestion ? (
        <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
          <p className="flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-100">
            <Sparkles className="size-3.5" /> Suggested rewrite — Nectar draft
          </p>
          <p className="whitespace-pre-wrap text-sm">{suggestion.text}</p>
          {suggestion.linked.length ? (
            <p className="text-muted-foreground">
              Accepting also updates{" "}
              {suggestion.linked.map((l) => fieldName(l, goalNames)).join(", ")}.
            </p>
          ) : null}
          {suggestion.drops.length ? (
            <p className="font-medium text-hive-danger">
              Drops something you wrote: {suggestion.drops.join(", ")}. Copy what you want instead.
            </p>
          ) : null}
          {pending.length ? (
            <ul className="list-disc pl-4 text-muted-foreground">
              {pending.map((f) => (
                <li key={f.key}>Nectar on this rewrite: {f.message}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {!suggestion.drops.length ? (
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={busy}
                onClick={() => onAccept(field)}
              >
                Accept
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={busy}
              onClick={() => onKeepMine(field)}
            >
              Keep mine
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
