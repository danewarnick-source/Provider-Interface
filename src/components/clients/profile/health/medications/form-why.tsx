// Form parts 2 and 3: "Why and what to watch for" (what it's for, common
// side effects, signs of a bad reaction, swallowing or choking risk) and
// "How they take it".

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ANY_MED_BAD_REACTION, getReference } from "@/lib/medications/reference";
import { HOW_TAKEN_VALUES, howTakenLabel } from "@/lib/medications/med-rules";
import { FormField, PartHeading, YesNo, type FormPartProps } from "./form-fields";

export function FormWhy({ v, set, errors, suggested }: FormPartProps) {
  const uses = getReference(v.reference_key)?.uses ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PartHeading>Why and what to watch for</PartHeading>
      <FormField label="What it's for" error={errors.purpose} suggested={uses.length > 0} wide>
        {uses.length ? (
          <div className="flex flex-wrap gap-1.5">
            {uses.map((u) => (
              <Button
                key={u}
                type="button"
                size="sm"
                variant={v.purpose === u ? "default" : "outline"}
                onClick={() => set({ purpose: u })}
              >
                {u}
              </Button>
            ))}
          </div>
        ) : null}
        <Input
          value={v.purpose}
          onChange={(e) => set({ purpose: e.target.value })}
          data-testid="med-purpose"
        />
      </FormField>
      <FormField
        label="Common side effects"
        error={errors.side_effects}
        suggested={suggested.has("side_effects")}
        wide
      >
        <Textarea
          rows={2}
          value={v.side_effects}
          onChange={(e) => set({ side_effects: e.target.value })}
        />
      </FormField>
      <FormField
        label="Signs of a bad reaction"
        error={errors.adverse_effects}
        suggested={suggested.has("adverse_effects")}
        hint={ANY_MED_BAD_REACTION}
        wide
      >
        <Textarea
          rows={2}
          value={v.adverse_effects}
          onChange={(e) => set({ adverse_effects: e.target.value })}
        />
      </FormField>
      <FormField
        label="Swallowing or choking risk?"
        error={errors.choking_risk}
        suggested={suggested.has("choking_risk")}
        wide
      >
        <YesNo
          value={v.choking_risk}
          onChange={(c) => set({ choking_risk: c })}
          testId="med-choking"
        />
      </FormField>

      <PartHeading>How they take it</PartHeading>
      <FormField label="Choose one" error={errors.how_taken} wide>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap" data-testid="med-how-taken">
          {HOW_TAKEN_VALUES.map((h) => (
            <Button
              key={h}
              type="button"
              size="sm"
              variant={v.how_taken === h ? "default" : "outline"}
              className="h-auto min-h-9 whitespace-normal text-left"
              onClick={() => set({ how_taken: h })}
            >
              {howTakenLabel(h)}
            </Button>
          ))}
        </div>
      </FormField>
    </div>
  );
}
