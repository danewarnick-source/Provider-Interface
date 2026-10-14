// Emergency plan: what staff do in a medical emergency for this person
// (clients.emergency_plan), written right here (Client medical: Edit).

import { useState } from "react";
import { Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cleanEmergencyPlan } from "@/lib/clients/health-options";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { useCanEditMedical, useSaveHealth, type ClientHealthRow } from "./use-client-health";

export function EmergencyPlanCard({ orgId, health }: { orgId: string; health: ClientHealthRow }) {
  const canEdit = useCanEditMedical();
  const [draft, setDraft] = useState<string | null>(null);
  const save = useSaveHealth(orgId, health.id, () => setDraft(null));
  const plan = health.emergency_plan?.trim() || null;
  const write = () => setDraft(plan ?? "");
  return (
    <SectionCard
      id="health-emergency-plan"
      icon={Siren}
      tone="danger"
      title="Emergency plan"
      description="What staff do in a medical emergency: who to call, where to go, what to bring."
      actions={
        canEdit && draft === null && plan ? (
          <EditButton label="Edit emergency plan" onClick={write} />
        ) : null
      }
      testId="client-health-emergency-plan"
    >
      {draft !== null ? (
        <>
          <Textarea
            autoFocus
            rows={5}
            aria-label="Emergency plan"
            placeholder={
              "Call 911.\nThen call the guardian.\nBring the medication list and insurance card."
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <SaveBar
            onCancel={() => setDraft(null)}
            saving={save.isPending}
            saveLabel="Save emergency plan"
            onSave={() => save.mutate({ emergency_plan: cleanEmergencyPlan(draft) })}
          />
        </>
      ) : plan ? (
        <p className="whitespace-pre-wrap text-sm text-hive-ink">{plan}</p>
      ) : (
        <EmptyState
          action={
            canEdit ? (
              <Button variant="outline" onClick={write}>
                Write the plan
              </Button>
            ) : null
          }
        >
          No emergency plan written yet.
        </EmptyState>
      )}
    </SectionCard>
  );
}
