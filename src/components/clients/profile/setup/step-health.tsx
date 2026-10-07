// Setup step 3, Health: short yes/no questions. Yes opens what to add (saved
// where the Health cards save); the medication, doctor-visit and advance
// directive answers go to client_support_scope and hide the cards that don't
// apply. Needs Client medical: Edit.

import { useState } from "react";
import { useClientCareData } from "@/hooks/use-client-care-data";
import { directiveStatus } from "@/lib/clients/health";
import type { ScopeAnswer, SupportScope } from "@/lib/clients/support-scope";
import { AdvanceDirectiveCard } from "@/components/clients/profile/health/advance-directive-card";
import { DietCard } from "@/components/clients/profile/health/diet-card";
import {
  useCanEditMedical,
  useClientHealth,
} from "@/components/clients/profile/health/use-client-health";
import { ListAnswer, MedicationChoices } from "./health-answers";
import { useSaveSupportScope } from "./use-support-scope";
import { YesNo } from "./yes-no";

const hasAny = (list: readonly string[] | null | undefined) => ((list ?? []).length ? true : null);

export function StepHealth({
  orgId,
  clientId,
  scope,
}: {
  orgId: string;
  clientId: string;
  scope: SupportScope | null;
}) {
  const canEdit = useCanEditMedical();
  const healthQ = useClientHealth(orgId, clientId);
  const care = useClientCareData(clientId);
  const save = useSaveSupportScope(orgId, clientId);
  const [local, setLocal] = useState<Record<string, boolean | null>>({});
  const h = healthQ.data;

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">
        Health needs Client medical: Edit. Skip this step; someone with that access can answer it
        in Health.
      </p>
    );
  }
  if (!h) return <p className="text-sm text-muted-foreground">Loading health details…</p>;

  const diet = care.data?.custom_fields.find((f) => f.field_key === "dietary_restrictions");
  const status = directiveStatus(h.dnr_status) ?? (h.polst_status ? "polst" : null);
  const asked = (key: string, fallback: boolean | null) => (key in local ? local[key] : fallback);
  const scoped = (answer: ScopeAnswer, fallback: boolean | null) =>
    asked(answer, scope?.[answer] ?? fallback);
  const answerScope = (answer: ScopeAnswer) => (v: boolean) => {
    setLocal((l) => ({ ...l, [answer]: v }));
    save.mutate({ answers: { [answer]: v } });
  };
  const answerLocal = (key: string) => (v: boolean) => setLocal((l) => ({ ...l, [key]: v }));

  return (
    <div data-testid="client-setup-health">
      <YesNo question="Any allergies?" value={asked("allergies", hasAny(h.allergies))} onChange={answerLocal("allergies")}>
        <ListAnswer
          orgId={orgId}
          health={h}
          fields={[{ key: "allergies", label: "Which allergies?" }]}
          saveLabel="Save allergies"
        />
      </YesNo>
      <YesNo
        question="Any diagnoses or ongoing conditions?"
        value={asked("diagnoses", hasAny(h.diagnoses) ?? hasAny(h.chronic_conditions))}
        onChange={answerLocal("diagnoses")}
      >
        <ListAnswer
          orgId={orgId}
          health={h}
          fields={[
            { key: "diagnoses", label: "Diagnoses (the first is the primary one)" },
            { key: "chronic_conditions", label: "Ongoing conditions" },
          ]}
          saveLabel="Save diagnoses and conditions"
        />
      </YesNo>
      <YesNo
        question="Special diet or eating needs (including trouble swallowing)?"
        value={asked("diet", h.dysphagia || diet?.value?.value_text ? true : null)}
        onChange={answerLocal("diet")}
      >
        <DietCard orgId={orgId} health={h} />
      </YesNo>
      <YesNo
        question="Advance directive or DNR?"
        value={scoped("has_advance_directive", status === "dnr" || status === "polst" ? true : null)}
        onChange={answerScope("has_advance_directive")}
        noNote="The Advance directive card is hidden."
      >
        <AdvanceDirectiveCard orgId={orgId} health={h} />
      </YesNo>
      <YesNo
        question="Does your agency help with medications?"
        value={scoped("helps_with_medications", null)}
        onChange={answerScope("helps_with_medications")}
        noNote="Medications are hidden on their profile."
      >
        <MedicationChoices orgId={orgId} clientId={clientId} />
      </YesNo>
      <YesNo
        question="Does your agency help with doctor visits?"
        value={scoped("helps_with_appointments", null)}
        onChange={answerScope("helps_with_appointments")}
        noNote="Health events and appointments are hidden; family handles them."
      />
    </div>
  );
}
