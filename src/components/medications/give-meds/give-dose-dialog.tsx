// Give meds: the dialog that logs one dose as given (time, route, PRN reason,
// controlled count and witness).

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { logMedicationPass } from "@/lib/medications/give-meds.functions";
import { prnStatus, takenAtProblem, type GiveLog, type GiveMed } from "@/lib/medications/give-meds";
import { NURSE_ROLES, type NurseRole } from "@/lib/medications/give-meds-pass";
import { MED_ROUTES, formatTime12 } from "@/lib/medications/med-display";
import { howTakenLabel } from "@/lib/medications/med-rules";
import { ControlledFields, type ControlledValues } from "./controlled-fields";
import { MedSummary } from "./dose-row";
import { PrnFields, RescueFields, type PrnValues, type RescueValues } from "./prn-fields";

export interface GiveTarget {
  med: GiveMed;
  /** Scheduled dose (UTC ISO + "HH:MM"); absent for an as-needed dose. */
  scheduledFor?: string;
  time?: string;
}

export interface PassContext {
  clientId: string;
  serviceContext?: string | null;
  scheduledShiftId?: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const NURSE_LABEL: Record<NurseRole, string> = {
  lpn: "LPN",
  rn: "RN",
  delegated: "Delegated by a nurse",
};

export function GiveDoseDialog({
  target,
  logs,
  ctx,
  onClose,
  onSaved,
}: {
  target: GiveTarget;
  logs: readonly GiveLog[];
  ctx: PassContext;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { med } = target;
  const save = useServerFn(logMedicationPass);
  // One id per dose: a retry after a dropped connection never makes a second row.
  const [requestId] = useState(() => crypto.randomUUID());
  const [route, setRoute] = useState(med.route?.trim() || "By mouth");
  const [takenAt, setTakenAt] = useState(() => toLocalInput(new Date()));
  const [note, setNote] = useState("");
  const [nurseRole, setNurseRole] = useState<NurseRole | "">("");
  const [prn, setPrn] = useState<PrnValues>({ reason: "", override: "" });
  const [rescue, setRescue] = useState<RescueValues>({
    seizureMinutes: "",
    outcome: "",
    emergencyCalled: false,
  });
  const [counts, setCounts] = useState<ControlledValues>({
    before: "",
    after: "",
    witnessConfirmationId: null,
    witnessName: null,
  });
  const [saving, setSaving] = useState(false);

  const takenIso = takenAt ? new Date(takenAt).toISOString() : "";
  const check = useMemo(
    () => prnStatus(med, logs, takenIso ? new Date(takenIso) : new Date()),
    [med, logs, takenIso],
  );
  const handsOn = med.how_taken === "assist" || med.how_taken === "nurse";
  const routes = MED_ROUTES.includes(route as (typeof MED_ROUTES)[number])
    ? [...MED_ROUTES]
    : [route, ...MED_ROUTES];

  async function submit() {
    const timeProblem = takenAtProblem(takenIso);
    if (timeProblem) return toast.error(timeProblem);
    if (med.how_taken === "nurse" && !nurseRole) return toast.error("Pick your nurse role.");
    if (med.is_prn && !prn.reason.trim()) return toast.error("Add why it's needed.");
    if (med.is_prn && check.nextAllowedAt && !prn.override.trim())
      return toast.error("Add a reason to give it anyway.");
    setSaving(true);
    try {
      const res = await save({
        data: {
          clientId: ctx.clientId,
          medicationId: med.id,
          scheduledFor: target.scheduledFor ?? null,
          scheduledTimeLabel: target.time ?? null,
          outcome: "given",
          route,
          actualTakenAt: takenIso,
          note: note.trim() || null,
          nurseRole: nurseRole || null,
          prnReason: med.is_prn ? prn.reason.trim() : null,
          prnOverrideReason: med.is_prn && check.nextAllowedAt ? prn.override.trim() : null,
          seizureDurationSeconds:
            med.is_rescue && rescue.seizureMinutes
              ? Math.round(Number(rescue.seizureMinutes) * 60)
              : null,
          seizureOutcome: med.is_rescue ? rescue.outcome.trim() || null : null,
          emergencyServicesCalled: med.is_rescue ? rescue.emergencyCalled : null,
          countBefore: med.is_controlled && counts.before !== "" ? Number(counts.before) : null,
          countAfter: med.is_controlled && counts.after !== "" ? Number(counts.after) : null,
          witnessConfirmationId: counts.witnessConfirmationId,
          serviceContext: ctx.serviceContext ?? null,
          scheduledShiftId: ctx.scheduledShiftId ?? null,
          clientRequestId: requestId,
        },
      });
      if (res.countFlagged)
        toast.warning(
          "Dose saved. The count doesn't match the record, so it's flagged for an admin.",
        );
      else toast.success("Dose saved.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the dose. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {target.time ? `Given: ${formatTime12(target.time)} dose` : "Give as needed"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <MedSummary med={med} />
          {med.how_taken ? (
            <p className="text-xs text-muted-foreground">{howTakenLabel(med.how_taken)}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Route</Label>
              <Select value={route} onValueChange={setRoute}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="taken-at">Time taken</Label>
              <Input
                id="taken-at"
                type="datetime-local"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          {med.how_taken === "nurse" ? (
            <div>
              <Label>Your nurse role *</Label>
              <Select value={nurseRole} onValueChange={(v) => setNurseRole(v as NurseRole)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {NURSE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {NURSE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {med.is_prn ? (
            <PrnFields check={check} values={prn} onChange={setPrn} callIf={med.prn_call_if} />
          ) : null}
          {med.is_rescue ? <RescueFields values={rescue} onChange={setRescue} /> : null}
          {med.is_controlled ? (
            <ControlledFields
              clientId={ctx.clientId}
              medicationId={med.id}
              needsWitness={handsOn}
              values={counts}
              onChange={setCounts}
            />
          ) : null}
          <div>
            <Label htmlFor="give-note">Note (optional)</Label>
            <Textarea
              id="give-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Saving confirms you checked the client, medication, dose, route and time, and that this
            record is accurate.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save dose"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
