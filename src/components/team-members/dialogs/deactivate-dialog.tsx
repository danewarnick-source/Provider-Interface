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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { denverYmd } from "@/lib/denver-date";
import {
  SEPARATION_REASONS,
  SEPARATION_REASON_LABEL,
  type SeparationReason,
} from "@/lib/team-members/profile";

export type DeactivateValues = {
  lastDay: string;
  reason: SeparationReason;
  rehireEligible: boolean;
  note: string;
};

/**
 * Deactivate is a soft move to Inactive in this agency — nothing is deleted,
 * and Reactivate undoes it. Records last day, reason and rehire eligibility;
 * the optional note is saved to the person's Notes.
 */
export function DeactivateDialog({
  name,
  busy,
  onConfirm,
  onClose,
}: {
  name: string | null;
  busy: boolean;
  onConfirm: (values: DeactivateValues) => void;
  onClose: () => void;
}) {
  const [lastDay, setLastDay] = useState(denverYmd());
  const [reason, setReason] = useState<SeparationReason | "">("");
  const [rehire, setRehire] = useState<"yes" | "no" | "">("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!name) return;
    setLastDay(denverYmd());
    setReason("");
    setRehire("");
    setNote("");
  }, [name]);

  const ready = !!lastDay && !!reason && !!rehire;

  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent data-testid="deactivate-dialog">
        <DialogHeader>
          <DialogTitle>Deactivate {name}?</DialogTitle>
          <DialogDescription>
            They move to Inactive and lose access to this agency. Nothing is deleted: their file,
            records and history stay, and you can reactivate them any time.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="deactivate-last-day">Last day</Label>
            <Input
              id="deactivate-last-day"
              type="date"
              value={lastDay}
              onChange={(e) => setLastDay(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deactivate-reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as SeparationReason)}>
              <SelectTrigger id="deactivate-reason">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {SEPARATION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {SEPARATION_REASON_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Eligible for rehire</Label>
            <RadioGroup
              value={rehire}
              onValueChange={(v) => setRehire(v as "yes" | "no")}
              className="flex gap-6"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="yes" /> Yes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="no" /> No
              </label>
            </RadioGroup>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deactivate-note">Note (optional)</Label>
            <Textarea
              id="deactivate-note"
              value={note}
              maxLength={5000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Saved to their Notes. Only people who manage hiring can read it."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !ready}
            onClick={() =>
              reason &&
              rehire &&
              onConfirm({ lastDay, reason, rehireEligible: rehire === "yes", note: note.trim() })
            }
          >
            {busy ? "Deactivating…" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
