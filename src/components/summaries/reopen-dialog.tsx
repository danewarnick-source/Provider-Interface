// Reopening a finalized progress summary: a confirm with an optional reason.
// The finalized copy is kept as a superseded version (reopenSummary).

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ReopenDialog({
  attested,
  pending,
  onCancel,
  onReopen,
}: {
  /** Which filing attestation will be withdrawn, if any. */
  attested: "upi" | "sc" | null;
  pending: boolean;
  onCancel: () => void;
  onReopen: (reason: string | null) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reopen this summary?</DialogTitle>
          <DialogDescription>
            The finalized copy is withdrawn: the evidence pack and the client&apos;s summary status
            go back to not done until you finalize again. The finalized copy is kept in the history.
            {attested === "upi" ? " The UPI entry attestation is withdrawn too." : ""}
            {attested === "sc"
              ? " The sent to Support Coordinator attestation is withdrawn too."
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="reopen-reason">Reason (optional)</Label>
          <Input
            id="reopen-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="What needs to change"
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => onReopen(reason.trim() || null)}
            data-testid="summary-reopen-confirm"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <RotateCcw className="size-4 mr-1" />
            )}
            Reopen for edits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
