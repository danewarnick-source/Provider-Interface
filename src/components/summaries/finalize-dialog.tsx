// Finalizing a progress summary: the preparer's name and the attestation
// that they reviewed the summary and take responsibility for it.

import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export function FinalizeDialog({
  finalizerName,
  setFinalizerName,
  aiAttested,
  setAiAttested,
  pending,
  onCancel,
  onFinalize,
}: {
  finalizerName: string;
  setFinalizerName: (v: string) => void;
  aiAttested: boolean;
  setAiAttested: (v: boolean) => void;
  pending: boolean;
  onCancel: () => void;
  onFinalize: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalize summary</DialogTitle>
          <DialogDescription>
            Required before the packet is locked. Your name appears as Prepared by.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="finalizer">Your full name</Label>
            <Input
              id="finalizer"
              value={finalizerName}
              onChange={(e) => setFinalizerName(e.target.value)}
              placeholder="Your full name"
              className="mt-1"
            />
          </div>
          <label className="flex items-start gap-2 text-sm rounded-md border p-3 bg-muted/30">
            <Checkbox
              checked={aiAttested}
              onCheckedChange={(v) => setAiAttested(v === true)}
              className="mt-0.5"
            />
            <span>
              I reviewed this summary and take responsibility for it.
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onCancel()}>
            Cancel
          </Button>
          <Button
            onClick={() => onFinalize()}
            disabled={!finalizerName.trim() || !aiAttested || pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="size-4 mr-1" />
            )}
            Finalize &amp; download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
