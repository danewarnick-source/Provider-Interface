import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clockTime, prnWarning } from "@/lib/medications/give-meds";
import type { PrnCheckResult } from "@/lib/medications/med-rules";

export interface PrnValues {
  reason: string;
  override: string;
}

/** Why an as-needed dose is given, and the too-soon / daily-max warning. */
export function PrnFields({
  check,
  values,
  onChange,
  callIf,
}: {
  check: PrnCheckResult;
  values: PrnValues;
  onChange: (v: PrnValues) => void;
  callIf?: string | null;
}) {
  const warning = prnWarning(check, clockTime);
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="prn-reason">Why is it needed? *</Label>
        <Textarea
          id="prn-reason"
          rows={2}
          value={values.reason}
          onChange={(e) => onChange({ ...values, reason: e.target.value })}
          placeholder="What you saw that means it's needed"
          className="mt-1"
        />
      </div>
      {callIf ? <p className="text-xs text-muted-foreground">Call if: {callIf}</p> : null}
      {warning ? (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {warning}
          </p>
          <Label htmlFor="prn-override" className="mt-2 block">
            Reason to give it anyway *
          </Label>
          <Input
            id="prn-override"
            value={values.override}
            onChange={(e) => onChange({ ...values, override: e.target.value })}
            placeholder="For example: nurse said to give it"
            className="mt-1 bg-background"
          />
          <p className="mt-1 text-xs">This dose will show as an exception on the MAR.</p>
        </div>
      ) : null}
    </div>
  );
}

export interface RescueValues {
  seizureMinutes: string;
  outcome: string;
  emergencyCalled: boolean;
}

/** Seizure length and outcome for a rescue medication. */
export function RescueFields({
  values,
  onChange,
}: {
  values: RescueValues;
  onChange: (v: RescueValues) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="seizure-min">Seizure length (minutes) *</Label>
        <Input
          id="seizure-min"
          inputMode="decimal"
          value={values.seizureMinutes}
          onChange={(e) => onChange({ ...values, seizureMinutes: e.target.value })}
          className="mt-1"
        />
      </div>
      <div className="flex items-end gap-2 pb-2">
        <input
          id="ems"
          type="checkbox"
          checked={values.emergencyCalled}
          onChange={(e) => onChange({ ...values, emergencyCalled: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="ems">911 was called</Label>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="seizure-outcome">What happened after? *</Label>
        <Textarea
          id="seizure-outcome"
          rows={2}
          value={values.outcome}
          onChange={(e) => onChange({ ...values, outcome: e.target.value })}
          className="mt-1"
        />
      </div>
    </div>
  );
}
