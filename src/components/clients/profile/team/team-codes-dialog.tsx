// Assign a team member to this client, or change one member's codes. The
// codes saved are always an explicit list (never "all codes"); the
// do-not-schedule list can't be assigned.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TeamCodesTarget = { staffId: string | null; name: string | null; codes: string[] };

export function TeamCodesDialog({
  target,
  clientCodes,
  choices,
  saving,
  onClose,
  onSave,
}: {
  target: TeamCodesTarget;
  clientCodes: string[];
  /** Team members who can be assigned (not on the team or the do-not-schedule list). */
  choices: { id: string; name: string }[];
  saving: boolean;
  onClose: () => void;
  onSave: (staffId: string, codes: string[]) => void;
}) {
  const adding = target.staffId === null;
  const [staffId, setStaffId] = useState(target.staffId ?? "");
  const [picked, setPicked] = useState<Set<string>>(
    new Set(adding ? clientCodes : target.codes),
  );
  const toggle = (c: string) => {
    const next = new Set(picked);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setPicked(next);
  };
  const codes = clientCodes.filter((c) => picked.has(c));
  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md" data-testid="team-codes-dialog">
        <DialogHeader>
          <DialogTitle>{adding ? "Assign a team member" : `Codes for ${target.name}`}</DialogTitle>
          <DialogDescription>
            They can only be scheduled for, and clock into, the codes checked here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {adding ? (
            <div className="grid gap-1.5">
              <Label>Team member</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger aria-label="Team member">
                  <SelectValue placeholder="Choose a team member" />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Codes</legend>
            {clientCodes.map((c) => (
              <label key={c} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={picked.has(c)} onCheckedChange={() => toggle(c)} />
                <span className="font-mono">{c}</span>
              </label>
            ))}
          </fieldset>
          {codes.length === 0 ? (
            <p className="text-xs text-destructive">Pick at least one code.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => onSave(staffId, codes)}
            disabled={!staffId || codes.length === 0 || saving}
          >
            {saving ? "Saving…" : adding ? "Assign team member" : "Save codes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
