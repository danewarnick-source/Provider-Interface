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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EvidencePerson } from "@/lib/evidence/types.ts";

export type SendEvidenceDraft = {
  itemIds: string[];
  titles: string[];
  staffId: string;
  needsStaffPicker: boolean;
};

export function SendEvidenceDialog({
  draft,
  staffPicker,
  pending,
  onClose,
  onSend,
}: {
  draft: SendEvidenceDraft | null;
  staffPicker: EvidencePerson[];
  pending: boolean;
  onClose: () => void;
  onSend: (args: { itemIds: string[]; staffId: string; message: string }) => void;
}) {
  const [staffId, setStaffId] = useState(draft?.staffId ?? "");
  const [message, setMessage] = useState("");
  const open = !!draft;

  useEffect(() => {
    setStaffId(draft?.staffId ?? "");
    setMessage("");
  }, [draft]);
  const chosen = draft?.needsStaffPicker ? staffId : (draft?.staffId ?? "");
  const canSend = open && chosen.length > 0 && draft.itemIds.length > 0 && !pending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setMessage("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send to team member</DialogTitle>
          <DialogDescription>
            {draft && draft.titles.length === 1
              ? `Send “${draft.titles[0]}” to their phone Evidence list.`
              : `Send ${draft?.itemIds.length ?? 0} items to their phone Evidence list.`}{" "}
            You can include a short message they will see when they open it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {draft?.needsStaffPicker ? (
            <div className="grid gap-1.5">
              <Label htmlFor="evidence-send-employee">Team member</Label>
              <select
                id="evidence-send-employee"
                value={staffId || draft.staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Choose a team member</option>
                {staffPicker.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="evidence-send-message">Message (optional)</Label>
            <Textarea
              id="evidence-send-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="What you need them to upload or attest"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSend}
            onClick={() => {
              if (!draft || !chosen) return;
              onSend({ itemIds: draft.itemIds, staffId: chosen, message: message.trim() });
              setMessage("");
            }}
          >
            {pending ? "Sending…" : "Send to team member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
