// End a rotation: asks for the last day it runs (today by default), then
// endRotation sets it and cancels the line's unsent drafts after that day
// (kept on record). Past weeks, published shifts and hand-edited shifts stay.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import { patternLabel, type RotationLine } from "@/lib/scheduler/rotation";
import { endRotation } from "@/lib/scheduler/rotation.functions";

export function EndRotationDialog({
  orgId,
  line,
  today,
  onClose,
}: {
  orgId: string;
  line: RotationLine;
  today: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [last, setLast] = useState(line.effective_until ?? today);
  const end = useServerFn(endRotation);
  const go = useMutation({
    mutationFn: () => end({ data: { id: line.id, organization_id: orgId, last_day: last } }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["scheduler-board"] });
      void qc.invalidateQueries({ queryKey: ["needs-you"] });
      toast.success(
        `Rotation ends ${fmtDay(last)}; past weeks unchanged${r.cancelled ? ` · ${r.cancelled} later drafts cancelled` : ""}`,
      );
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const why = !/^\d{4}-\d{2}-\d{2}$/.test(last) ? "Pick the last day." : null;
  return (
    <Dialog open onOpenChange={(o) => !o && !go.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>End this rotation</DialogTitle>
          <DialogDescription>
            {patternLabel(line)}. Its unsent drafts after the last day are cancelled and kept on
            record. Past weeks, sent shifts and shifts you edited by hand stay as they are.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-1.5 text-sm font-bold">
          <span>Last day it runs</span>
          <Input type="date" autoFocus value={last} onChange={(e) => setLast(e.target.value)} />
        </label>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={!!why || go.isPending}
            title={why ?? undefined}
            onClick={() => go.mutate()}
          >
            {go.isPending ? "Ending…" : "End rotation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
