// Form part 1, "The medication": name (type-ahead from the built-in list),
// strength and dose form picks, dose, route, times or as needed, how to give
// it, dates, prescriber, pharmacy, Rx number, packaging and label photo.

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getReference, type MedicationReference } from "@/lib/medications/reference";
import { strengthOptions } from "@/lib/medications/med-form";
import { PACKAGING_OPTIONS } from "@/lib/medications/med-display";
import { ORIGINAL_BOTTLE } from "@/lib/medications/med-rules";
import { CheckRow, FileField, FormField, PartHeading, type FormPartProps } from "./form-fields";
import { NameTypeahead } from "./name-typeahead";
import { TimeChips } from "./time-chips";

const ROUTES = [
  "By mouth",
  "Under the tongue",
  "On the skin",
  "Inhaled",
  "In the eye",
  "In the ear",
  "In the nose",
  "Rectal",
  "Injection",
  "Feeding tube",
];

export function FormMedication({
  v,
  set,
  errors,
  clientId,
  onPick,
}: FormPartProps & { onPick: (ref: MedicationReference) => void }) {
  const ref = getReference(v.reference_key);
  const picks = ref ? strengthOptions(ref.forms) : [];
  const fromList = !!ref;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PartHeading>The medication</PartHeading>
      <FormField label="Name" error={errors.medication_name} wide>
        <NameTypeahead
          value={v.medication_name}
          onType={(name) =>
            set({
              medication_name: name,
              reference_key: name === ref?.name ? v.reference_key : null,
            })
          }
          onPick={onPick}
        />
      </FormField>
      {picks.length ? (
        <FormField label="Strength and form from the list" suggested wide>
          <div className="flex flex-wrap gap-1.5">
            {picks.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant={
                  v.strength === p.strength && v.dose_form === p.doseForm ? "default" : "outline"
                }
                onClick={() => set({ strength: p.strength, dose_form: p.doseForm })}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </FormField>
      ) : null}
      <FormField label="Strength" suggested={fromList && !!v.strength} error={errors.dosage}>
        <Input
          value={v.strength}
          onChange={(e) => set({ strength: e.target.value })}
          placeholder="e.g. 50 mg"
        />
      </FormField>
      <FormField label="Dose form" suggested={fromList && !!v.dose_form}>
        <Input
          value={v.dose_form}
          onChange={(e) => set({ dose_form: e.target.value })}
          placeholder="e.g. tablet"
        />
      </FormField>
      <FormField label="Dose (how much each time)">
        <Input
          value={v.dosage}
          onChange={(e) => set({ dosage: e.target.value })}
          placeholder="e.g. 1 tablet"
          data-testid="med-dose"
        />
      </FormField>
      <FormField label="Route" error={errors.route}>
        <Input
          list="med-routes"
          value={v.route}
          onChange={(e) => set({ route: e.target.value })}
          data-testid="med-route"
        />
        <datalist id="med-routes">
          {ROUTES.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </FormField>
      <CheckRow checked={v.is_prn} onChange={(c) => set({ is_prn: c })} testId="med-prn-toggle">
        As needed (PRN)
      </CheckRow>
      {!v.is_prn ? (
        <FormField label="Times it's given" error={errors.scheduled_times} wide>
          <TimeChips times={v.scheduled_times} onChange={(t) => set({ scheduled_times: t })} />
        </FormField>
      ) : null}
      <FormField label="How to give it" wide>
        <Textarea
          rows={2}
          value={v.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
          placeholder="e.g. With food and a full glass of water"
        />
      </FormField>
      <FormField label="Start date" error={errors.start_date}>
        <Input
          type="date"
          value={v.start_date}
          onChange={(e) => set({ start_date: e.target.value })}
        />
      </FormField>
      <FormField label="Stop date (optional)" error={errors.end_date}>
        <Input type="date" value={v.end_date} onChange={(e) => set({ end_date: e.target.value })} />
      </FormField>
      <FormField label="Prescriber" error={errors.prescriber}>
        <Input value={v.prescriber} onChange={(e) => set({ prescriber: e.target.value })} />
      </FormField>
      <FormField label="Pharmacy">
        <Input value={v.pharmacy} onChange={(e) => set({ pharmacy: e.target.value })} />
      </FormField>
      <FormField label="Rx number">
        <Input value={v.rx_number} onChange={(e) => set({ rx_number: e.target.value })} />
      </FormField>
      <FormField label="Packaging" error={errors.packaging ?? errors.packaging_approval_path}>
        <div className="flex flex-wrap gap-2">
          {PACKAGING_OPTIONS.map((o) => (
            <Button
              key={o.value}
              type="button"
              size="sm"
              variant={v.packaging === o.value ? "default" : "outline"}
              onClick={() => set({ packaging: o.value })}
            >
              {o.label}
            </Button>
          ))}
        </div>
        {v.packaging && !PACKAGING_OPTIONS.some((o) => o.value === v.packaging) ? (
          <p className="text-[11px] text-muted-foreground">
            On file: {v.packaging}. Pick one to update it.
          </p>
        ) : null}
      </FormField>
      {v.packaging === ORIGINAL_BOTTLE ? (
        <FormField
          label="Written approval for the original bottle"
          hint="§1.23(c)(1) needs written DSPD approval"
          wide
        >
          <FileField
            clientId={clientId}
            kind="approval"
            path={v.packaging_approval_path}
            onChange={(p) => set({ packaging_approval_path: p })}
            label="Upload approval"
          />
        </FormField>
      ) : null}
      <FormField label="Pharmacy label photo (optional)" wide>
        <FileField
          clientId={clientId}
          kind="label"
          path={v.label_photo_path}
          onChange={(p) => set({ label_photo_path: p })}
          label="Upload label photo"
        />
      </FormField>
    </div>
  );
}
