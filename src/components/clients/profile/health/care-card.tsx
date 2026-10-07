// Emergency treatment authorization, acquired brain injury (ABI) and the
// medication support level, with the client's medications and eMAR below.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { medicationSupportLabel } from "@/lib/clients/health";
import { onClientDutyFactsChanged } from "@/lib/staff-assignment-hooks.functions";
import { MarEmarTab } from "@/components/workspace/mar-emar-tab";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { Field, FieldGrid } from "@/components/clients/profile/cards/card-parts";
import { useCanEditMedical, useSaveHealth, type ClientHealthRow } from "./use-client-health";

type Draft = { treatment: boolean; abi: boolean };

export function CareCard({
  orgId,
  health,
  clientName,
}: {
  orgId: string;
  health: ClientHealthRow;
  clientName: string;
}) {
  const dutyFactsFn = useServerFn(onClientDutyFactsChanged);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showMeds, setShowMeds] = useState(false);
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
      icon={Pill}
      tone="danger"
      title="Care and medications"
      description="Emergency treatment, brain injury and how much help they need with medications."
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/dashboard/emar">Open eMAR board</Link>
          </Button>
          {canEdit && draft === null ? (
            <EditButton
              label="Edit care and medications"
              onClick={() =>
                setDraft({
                  treatment: health.emergency_medical_treatment_authorization === true,
                  abi: abiBefore,
                })
              }
            />
          ) : null}
        </>
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
          <Field label="Medication support">
            {medicationSupportLabel(health.self_admin_med_support)}
          </Field>
        </FieldGrid>
      )}
      {draft ? (
        <SaveBar
          onCancel={() => setDraft(null)}
          saving={save.isPending}
          saveLabel="Save care details"
          onSave={() =>
            save.mutate({
              emergency_medical_treatment_authorization: draft.treatment,
              has_abi: draft.abi,
            })
          }
        />
      ) : null}
      <div className="flex flex-wrap gap-2 pt-4">
        <Button
          variant="outline"
          onClick={() => setShowMeds((v) => !v)}
          data-testid="client-meds-toggle"
        >
          {showMeds ? "Hide medications" : "Show medications and eMAR"}
        </Button>
      </div>
      {showMeds ? (
        <div className="pt-3">
          <MarEmarTab clientId={health.id} clientName={clientName} />
        </div>
      ) : null}
    </SectionCard>
  );
}
