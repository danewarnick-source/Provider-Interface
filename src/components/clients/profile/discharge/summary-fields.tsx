// Discharge summary editor: the text, an "Ask Nectar to draft" button, and
// the confirm box. A Nectar draft is marked as one until a person confirms it.

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type SummaryDraftState = { text: string; draftedByNectar: boolean; confirmed: boolean };

export function SummaryFields({
  value,
  onChange,
  onDraft,
  drafting,
}: {
  value: SummaryDraftState;
  onChange: (next: SummaryDraftState) => void;
  onDraft: (() => void) | null;
  drafting: boolean;
}) {
  return (
    <div className="space-y-2" data-testid="discharge-summary-fields">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="discharge-summary">Discharge summary</Label>
        {onDraft ? (
          <Button
            type="button"
            variant="outline"
            disabled={drafting}
            onClick={onDraft}
            data-testid="discharge-summary-draft"
          >
            {drafting ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-3.5 w-3.5" />
            )}
            {drafting ? "Drafting…" : "Ask Nectar to draft"}
          </Button>
        ) : null}
      </div>
      {value.draftedByNectar ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Nectar's draft, from what is on file. Read it, fix anything wrong, then confirm.
        </p>
      ) : null}
      <Textarea
        id="discharge-summary"
        rows={7}
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value, confirmed: false })}
        placeholder="Why services ended, what was provided, goals worked on, and what the next provider should know."
      />
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={value.confirmed}
          disabled={!value.text.trim()}
          onCheckedChange={(c) => onChange({ ...value, confirmed: c === true })}
          data-testid="discharge-summary-confirm"
        />
        <span>I've read this summary and it is accurate.</span>
      </label>
    </div>
  );
}
