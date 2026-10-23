// Give meds: the dialog that logs a scheduled dose as not given, with the reason.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logMedicationPass } from "@/lib/medications/give-meds.functions";
import { NOT_GIVEN_REASONS, type NotGivenReason } from "@/lib/medications/give-meds";
import { formatTime12 } from "@/lib/medications/med-display";
import { MedSummary } from "./dose-row";
import type { GiveTarget, PassContext } from "./give-dose-dialog";

export function NotGivenDialog({
  target,
  ctx,
  onClose,
  onSaved,
}: {
  target: GiveTarget;
  ctx: PassContext;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(logMedicationPass);
  const [requestId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState<NotGivenReason | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!reason) return toast.error("Pick why it wasn't given.");
    if (reason === "other" && !note.trim()) return toast.error("Say why it wasn't given.");
    setSaving(true);
    try {
      await save({
        data: {
          clientId: ctx.clientId,
          medicationId: target.med.id,
          scheduledFor: target.scheduledFor ?? null,
          scheduledTimeLabel: target.time ?? null,
          outcome: "not_given",
          notGivenReason: reason,
          note: note.trim() || null,
          route: target.med.route?.trim() || "By mouth",
          serviceContext: ctx.serviceContext ?? null,
          scheduledShiftId: ctx.scheduledShiftId ?? null,
          clientRequestId: requestId,
        },
      });
      toast.success("Saved as not given.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Not given{target.time ? `: ${formatTime12(target.time)} dose` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <MedSummary med={target.med} />
          <div className="grid grid-cols-2 gap-2">
            {NOT_GIVEN_REASONS.map((r) => (
              <Button
                key={r.value}
                type="button"
                variant={reason === r.value ? "default" : "outline"}
                className="h-auto min-h-11 whitespace-normal py-2"
                onClick={() => setReason(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <div>
            <Label htmlFor="not-given-note">Note {reason === "other" ? "*" : "(optional)"}</Label>
            <Textarea
              id="not-given-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
