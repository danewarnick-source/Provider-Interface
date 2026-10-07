// "Not needed for this client": pick a reason (or write one). Saved on the
// Evidence item as skipped with that reason (removeEvidenceRequirement); the
// item and its files stay on record and it can be undone.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const NOT_NEEDED_REASONS = [
  "Person declined",
  "Doesn't apply to this client",
  "Kept outside PI",
] as const;

export function NotNeededDialog({
  title,
  pending,
  onCancel,
  onConfirm,
}: {
  /** Null = closed. */
  title: string | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState("");
  useEffect(() => {
    setChoice(null);
    setOther("");
  }, [title]);
  const reason = choice === "Other" ? other.trim() : (choice ?? "");

  return (
    <Dialog open={!!title} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md" data-testid="not-needed-dialog">
        <DialogHeader>
          <DialogTitle>Not needed for this client</DialogTitle>
          <DialogDescription>
            “{title}” stays on record with any files, shows as Not needed and stops counting as
            missing. You can undo this later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Reason">
          {[...NOT_NEEDED_REASONS, "Other"].map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={choice === r}
              onClick={() => setChoice(r)}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm",
                choice === r
                  ? "border-hive-ink bg-hive-gold-soft font-medium text-hive-ink"
                  : "border-hive-border bg-hive-surface text-muted-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
        {choice === "Other" && (
          <Input
            autoFocus
            aria-label="Reason"
            placeholder="Why isn't this needed?"
            maxLength={200}
            value={other}
            onChange={(e) => setOther(e.target.value)}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={pending || !reason} onClick={() => onConfirm(reason)}>
            {pending ? "Saving…" : "Mark not needed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
