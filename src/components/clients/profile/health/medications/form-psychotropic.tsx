// Form part "Psychotropic" (only when ticked): type, what it treats, whether
// it's used to manage behavior (then the behavior support plan and the
// rights restriction it relies on), consent and the next prescriber review.
// Missing pieces are reminders; saving is still allowed.

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useClientRestrictions } from "@/components/clients/profile/plans/use-hrr";
import {
  CheckRow,
  FileField,
  FormField,
  PartHeading,
  YesNo,
  type FormPartProps,
} from "./form-fields";

const TYPES = [
  "antipsychotic",
  "antidepressant",
  "mood stabilizer",
  "anti-anxiety",
  "stimulant",
  "sleep",
  "other",
];
/** Same document types as the Plans → Behavior support plan card. */
const BSP_TYPES = ["bsp", "behavior_support_plan"];

function useBspDocuments(clientId: string) {
  return useQuery({
    queryKey: ["client-bsp-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, file_name, uploaded_at")
        .eq("client_id", clientId)
        .in("document_type", BSP_TYPES)
        .is("archived_at", null)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; file_name: string; uploaded_at: string | null }>;
    },
  });
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={selected ? "default" : "outline"}
      onClick={onClick}
      className="h-auto min-h-9 whitespace-normal text-left"
    >
      {children}
    </Button>
  );
}

function BehaviorLinks({ v, set, clientId }: FormPartProps) {
  const bsps = useBspDocuments(clientId).data ?? [];
  const hrrs = useClientRestrictions(clientId).data ?? [];
  return (
    <>
      <FormField label="Behavior support plan" wide>
        {bsps.length ? (
          <div className="flex flex-wrap gap-1.5">
            {bsps.map((d) => (
              <Choice
                key={d.id}
                selected={v.bsp_document_id === d.id}
                onClick={() => set({ bsp_document_id: d.id })}
              >
                {d.file_name}
              </Choice>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No behavior support plan on file. Add it under Plans.
          </p>
        )}
      </FormField>
      <FormField label="Rights restriction (Human Rights Committee approval)" wide>
        {hrrs.length ? (
          <div className="flex flex-wrap gap-1.5">
            {hrrs.map((r) => (
              <Choice
                key={r.id}
                selected={v.hrc_restriction_id === r.id}
                onClick={() => set({ hrc_restriction_id: r.id })}
              >
                {r.restriction_title}
              </Choice>
            ))}
          </div>
        ) : (
          <p className="text-xs text-amber-700" data-testid="med-no-hrc">
            No Human Rights Committee approval on file. Add it under Plans → Rights restrictions.
          </p>
        )}
      </FormField>
    </>
  );
}

export function FormPsychotropic(props: FormPartProps) {
  const { v, set, suggested, clientId } = props;
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="med-psych-part">
      <PartHeading>Psychotropic</PartHeading>
      <FormField label="Type" suggested={suggested.has("psychotropic_type")} wide>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <Choice
              key={t}
              selected={v.psychotropic_type === t}
              onClick={() => set({ psychotropic_type: t })}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </Choice>
          ))}
        </div>
      </FormField>
      <FormField label="What it treats" wide>
        <Input value={v.diagnosis} onChange={(e) => set({ diagnosis: e.target.value })} />
      </FormField>
      <FormField label="Used to manage behavior?" wide>
        <YesNo value={v.used_for_behavior} onChange={(c) => set({ used_for_behavior: c })} />
      </FormField>
      {v.used_for_behavior ? <BehaviorLinks {...props} /> : null}
      <FormField label="Consent date">
        <Input
          type="date"
          value={v.consent_date}
          onChange={(e) => set({ consent_date: e.target.value })}
        />
      </FormField>
      <FormField label="Next prescriber review">
        <Input
          type="date"
          value={v.next_review_date}
          onChange={(e) => set({ next_review_date: e.target.value })}
        />
      </FormField>
      <FormField label="Signed consent" wide>
        <FileField
          clientId={clientId}
          kind="consent"
          path={v.consent_document_path}
          onChange={(p) => set({ consent_document_path: p })}
          label="Upload consent"
        />
      </FormField>
    </div>
  );
}

export function PartToggles({ v, set }: Pick<FormPartProps, "v" | "set">) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      <CheckRow
        checked={v.is_psychotropic}
        onChange={(c) => set({ is_psychotropic: c })}
        testId="med-psych-toggle"
      >
        Psychotropic medication
      </CheckRow>
      <CheckRow
        checked={v.is_controlled}
        onChange={(c) => set({ is_controlled: c })}
        testId="med-controlled-toggle"
      >
        Controlled substance
      </CheckRow>
    </div>
  );
}
