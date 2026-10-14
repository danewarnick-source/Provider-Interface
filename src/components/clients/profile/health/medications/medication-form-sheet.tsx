// Add or edit a medication (a sheet on desktop and phone). Four parts; the
// PRN, psychotropic and controlled parts show only when ticked. Saves
// through saveMedication; required-field errors show inline.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { denverYmd } from "@/lib/denver-date";
import {
  applyReference,
  emptyMedForm,
  medFormErrors,
  medFormFromRow,
  medInputFromForm,
  type MedFormValues,
  type SuggestedField,
} from "@/lib/medications/med-form";
import { psychotropicWarnings } from "@/lib/medications/med-rules";
import type { MedicationReference } from "@/lib/medications/reference";
import { FormMedication } from "./form-medication";
import { FormWhy } from "./form-why";
import { FormControlled, FormPrn } from "./form-prn";
import { FormPsychotropic, PartToggles } from "./form-psychotropic";
import { useSaveMedication, type ClientMedication } from "./use-medications";

export function MedicationFormSheet({
  clientId,
  medication,
  open,
  onClose,
}: {
  clientId: string;
  /** null adds a new medication. */
  medication: ClientMedication | null;
  open: boolean;
  onClose: () => void;
}) {
  const [v, setV] = useState<MedFormValues>(() => emptyMedForm(denverYmd()));
  const [suggested, setSuggested] = useState<Set<SuggestedField>>(new Set());
  const [tried, setTried] = useState(false);
  const save = useSaveMedication(clientId);

  useEffect(() => {
    if (!open) return;
    setV(
      medication
        ? medFormFromRow(medication as unknown as Record<string, unknown>)
        : emptyMedForm(denverYmd()),
    );
    setSuggested(new Set());
    setTried(false);
  }, [open, medication]);

  const set = (patch: Partial<MedFormValues>) => {
    setV((cur) => ({ ...cur, ...patch }));
    setSuggested((cur) => {
      const keys = Object.keys(patch).filter((k) => cur.has(k as SuggestedField));
      if (!keys.length) return cur;
      const next = new Set(cur);
      for (const k of keys) next.delete(k as SuggestedField);
      return next;
    });
  };
  const pick = (ref: MedicationReference) => {
    const r = applyReference(v, ref, suggested);
    setV(r.values);
    setSuggested(r.suggested);
  };

  const errors = tried ? medFormErrors(v) : {};
  const reminders = psychotropicWarnings(medInputFromForm(v));
  const parts = { v, set, errors, suggested, clientId };

  const submit = () => {
    setTried(true);
    if (Object.keys(medFormErrors(v)).length) return;
    save.mutate(
      { id: medication?.id ?? null, medication: medInputFromForm(v) },
      { onSuccess: onClose },
    );
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        data-testid="med-form-sheet"
      >
        <SheetHeader className="border-b p-5">
          <SheetTitle>
            {medication ? `Edit ${medication.medication_name}` : "Add medication"}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <FormMedication {...parts} onPick={pick} />
          <FormWhy {...parts} />
          <PartToggles v={v} set={set} />
          {v.is_prn ? <FormPrn {...parts} /> : null}
          {v.is_psychotropic ? <FormPsychotropic {...parts} /> : null}
          {v.is_controlled ? <FormControlled {...parts} /> : null}
          {reminders.length ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              {reminders.map((r) => r.message).join(" · ")}. You can save now and add these later.
            </p>
          ) : null}
        </div>
        <SheetFooter className="flex-row justify-end gap-2 border-t p-4">
          {tried && Object.keys(errors).length ? (
            <p className="mr-auto self-center text-xs text-[var(--hive-danger-fg)]">
              Fill in the fields marked above.
            </p>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending} data-testid="med-save">
            {save.isPending ? "Saving…" : "Save medication"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
