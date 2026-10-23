// Care needs: emergency treatment authorization and acquired brain injury
// (ABI), which changes who may work alone with the client.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HandHeart } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { onClientDutyFactsChanged } from "@/lib/staff-assignment-hooks.functions";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { Field, FieldGrid } from "@/components/clients/profile/cards/card-parts";
import { useCanEditMedical, useSaveHealth, type ClientHealthRow } from "./use-client-health";

type Draft = { treatment: boolean; abi: boolean };

export function CareNeedsCard({ orgId, health }: { orgId: string; health: ClientHealthRow }) {
  const dutyFactsFn = useServerFn(onClientDutyFactsChanged);
  const [draft, setDraft] = useState<Draft | null>(null);
  const canEdit = useCanEditMedical();
  const abiBefore = health.has_abi === true;
  const save = useSaveHealth(orgId, health.id, async () => {
    // ABI changes which team members may work alone with the client.
    if (draft && draft.abi !== abiBefore) {
      try {
        await dutyFactsFn({ data: { organizationId: orgId, clientId: health.id } });
      } catch (e) {
        console.warn("[obligations] client duty reevaluate failed:", e);
      }
    }
    setDraft(null);
  });
  const toggle = (id: keyof Draft, label: string) => (
    <div className="flex items-center gap-3">
      <Switch
        id={`care-${id}`}
        checked={draft?.[id] ?? false}
        onCheckedChange={(v) => setDraft((d) => (d ? { ...d, [id]: v } : d))}
      />
      <Label htmlFor={`care-${id}`} className="text-sm">
        {label}
      </Label>
    </div>
  );
  return (
    <SectionCard
      id="health-care-needs"
      icon={HandHeart}
      tone="danger"
      title="Care needs"
      description="Emergency treatment consent and brain injury, which decides who may work alone with them."
      actions={
        canEdit && draft === null ? (
          <EditButton
            label="Edit care needs"
            onClick={() =>
              setDraft({
                treatment: health.emergency_medical_treatment_authorization === true,
                abi: abiBefore,
              })
            }
          />
        ) : null
      }
    >
      {draft ? (
        <div className="space-y-3">
          {toggle("treatment", "Emergency treatment authorization signed")}
          {toggle("abi", "Acquired brain injury (team members need ABI training)")}
        </div>
      ) : (
        <FieldGrid>
          <Field label="Emergency treatment authorization">
            {health.emergency_medical_treatment_authorization ? "Signed" : "Not on file"}
          </Field>
          <Field label="Acquired brain injury (ABI)">
            {health.has_abi ? "Yes, ABI training needed" : "No"}
          </Field>
        </FieldGrid>
      )}
      {draft ? (
        <SaveBar
          onCancel={() => setDraft(null)}
          saving={save.isPending}
          saveLabel="Save care needs"
          onSave={() =>
            save.mutate({
              emergency_medical_treatment_authorization: draft.treatment,
              has_abi: draft.abi,
            })
          }
        />
      ) : null}
    </SectionCard>
  );
}
