// Form part "PRN" (only when As needed is ticked) and part "Controlled"
// (only when Controlled substance is ticked).

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckRow, FormField, PartHeading, type FormPartProps } from "./form-fields";

export function FormPrn({ v, set, errors }: FormPartProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="med-prn-part">
      <PartHeading>As needed (PRN)</PartHeading>
      <FormField label="When to give it" error={errors.prn_instructions} wide>
        <Textarea
          rows={2}
          value={v.prn_instructions}
          onChange={(e) => set({ prn_instructions: e.target.value })}
        />
      </FormField>
      <FormField label="What to try first" wide>
        <Textarea
          rows={2}
          value={v.prn_try_first}
          onChange={(e) => set({ prn_try_first: e.target.value })}
        />
      </FormField>
      <FormField label="Minimum hours between doses" error={errors.prn_min_hours}>
        <Input
          type="number"
          min={0}
          step="0.5"
          inputMode="decimal"
          value={v.prn_min_hours}
          onChange={(e) => set({ prn_min_hours: e.target.value })}
        />
      </FormField>
      <FormField label="Most doses in 24 hours" error={errors.prn_max_per_day}>
        <Input
          type="number"
          min={1}
          step="1"
          inputMode="numeric"
          value={v.prn_max_per_day}
          onChange={(e) => set({ prn_max_per_day: e.target.value })}
        />
      </FormField>
      <FormField
        label="Check whether it worked after (minutes)"
        error={errors.prn_followup_minutes}
      >
        <Input
          type="number"
          min={1}
          step="5"
          inputMode="numeric"
          value={v.prn_followup_minutes}
          onChange={(e) => set({ prn_followup_minutes: e.target.value })}
        />
      </FormField>
      <FormField label="Call the nurse or prescriber if" wide>
        <Textarea
          rows={2}
          value={v.prn_call_if}
          onChange={(e) => set({ prn_call_if: e.target.value })}
        />
      </FormField>
      <CheckRow checked={v.is_rescue} onChange={(c) => set({ is_rescue: c })}>
        Rescue medication (seizure or allergy)
      </CheckRow>
    </div>
  );
}

const SCHEDULES = ["II", "III", "IV", "V"];

export function FormControlled({ v, set, errors, suggested }: FormPartProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="med-controlled-part">
      <PartHeading>Controlled substance</PartHeading>
      <FormField
        label="Schedule"
        error={errors.controlled_schedule}
        suggested={suggested.has("controlled_schedule")}
      >
        <div className="flex gap-1.5">
          {SCHEDULES.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={v.controlled_schedule === s ? "default" : "outline"}
              onClick={() => set({ controlled_schedule: s })}
            >
              C-{s}
            </Button>
          ))}
        </div>
      </FormField>
      <FormField label="Count on hand now" error={errors.pill_count_current}>
        <Input
          type="number"
          min={0}
          step="1"
          inputMode="numeric"
          value={v.pill_count_current}
          onChange={(e) => set({ pill_count_current: e.target.value })}
        />
      </FormField>
    </div>
  );
}
