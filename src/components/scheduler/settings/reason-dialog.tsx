// A risky-action dialog for Settings: says what will happen and asks for a
// reason (removing a shift type, undoing a sign-off). Typed text is never
// dropped on click-out or Escape; Cancel discards it.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ReasonDialog({
  open,
  title,
  body,
  action,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  action: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const short = reason.trim().length < 3;
  const close = () => {
    setReason("");
    onCancel();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !reason.trim()) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          aria-label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why"
          maxLength={500}
        />
        {short && <p className="text-xs text-muted-foreground">Type a reason to continue.</p>}
        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={close}>
            Cancel
          </Button>
          <Button
            className="min-h-11"
            disabled={short || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onConfirm(reason.trim());
              setBusy(false);
              if (ok) close();
            }}
          >
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
