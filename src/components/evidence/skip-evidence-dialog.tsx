// Skip an Evidence item. SOW items first confirm "Are you sure? This was found
// to be a requirement in the SOW." Every skip needs a reason — it is saved with
// who / when on the item (opted_out_*), never a delete.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requirementByKey } from "@/lib/evidence/catalog.ts";
import {
  EVIDENCE_UNCHECK_TITLE,
  EVIDENCE_UNCHECK_WARNING,
  type EvidenceItemRow,
} from "@/lib/evidence/types.ts";

/** True for catalog rows that come from the SOW (not custom rows or agency forms). */
function isSowEvidenceItem(
  item: Pick<EvidenceItemRow, "requirement_key" | "sow_cite">,
): boolean {
  return !!requirementByKey(item.requirement_key)?.sowCite;
}

export function SkipEvidenceDialog({
  item,
  pending,
  onCancel,
  onConfirm,
}: {
  /** Null = closed. */
  item: Pick<EvidenceItemRow, "id" | "title" | "requirement_key" | "sow_cite"> | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const sow = !!item && isSowEvidenceItem(item);
  const [step, setStep] = useState<"confirm" | "reason">("reason");
  const [reason, setReason] = useState("");

  useEffect(() => {
    setStep(sow ? "confirm" : "reason");
    setReason("");
  }, [item?.id, sow]);

  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        {step === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle>{EVIDENCE_UNCHECK_TITLE}</DialogTitle>
              <DialogDescription>{EVIDENCE_UNCHECK_WARNING}</DialogDescription>
            </DialogHeader>
            {item?.sow_cite ? (
              <p className="text-xs text-muted-foreground">SOW: {item.sow_cite}</p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => setStep("reason")}>Skip anyway</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Skip “{item?.title}”</DialogTitle>
              <DialogDescription>
                The item and any files stay on record. Your name, the date and this reason are
                saved, and you can restore it later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="skip-reason">Reason</Label>
              <Textarea
                id="skip-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why doesn't this apply to this person?"
                rows={3}
                maxLength={1000}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                disabled={pending || reason.trim().length === 0}
                onClick={() => onConfirm(reason.trim())}
              >
                {pending ? "Skipping…" : "Skip item"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
