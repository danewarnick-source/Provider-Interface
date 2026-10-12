// Diet and swallowing: special diet or eating needs (the agency's "Dietary
// restrictions" profile field, saved like More details), trouble swallowing
// and the alerts staff see at meals and on the eMAR (clients columns).
// Client medical: Edit to change.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Utensils } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useClientCareData } from "@/hooks/use-client-care-data";
import { setCustomFieldValue } from "@/lib/clients/custom-fields.functions";
import { splitList } from "@/lib/clients/health";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { Field, FieldGrid } from "@/components/clients/profile/cards/card-parts";
import { useCanEditMedical, useSaveHealth, type ClientHealthRow } from "./use-client-health";

type Draft = { diet: string; dysphagia: boolean; alerts: string };
const DIET_KEY = "dietary_restrictions";

export function DietCard({ orgId, health }: { orgId: string; health: ClientHealthRow }) {
  const qc = useQueryClient();
  const care = useClientCareData(health.id);
  const dietField = care.data?.custom_fields.find((f) => f.field_key === DIET_KEY) ?? null;
  const diet = dietField?.value?.value_text?.trim() || null;
  const dietFn = useServerFn(setCustomFieldValue);
  const canEdit = useCanEditMedical();
  const [draft, setDraft] = useState<Draft | null>(null);
  const save = useSaveHealth(orgId, health.id, async () => {
    if (dietField && draft && draft.diet.trim() !== (diet ?? "")) {
      await dietFn({
        data: {
          organizationId: orgId,
          definitionId: dietField.id,
          entityKind: "client",
          entityId: health.id,
          value_text: draft.diet.trim() || null,
        },
      });
      void qc.invalidateQueries({ queryKey: ["client-care-data", health.id] });
    }
    setDraft(null);
  });
  const alerts = health.swallowing_alerts ?? [];
  return (
    <SectionCard
      id="health-diet"
      icon={Utensils}
      tone="danger"
      title="Diet and swallowing"
      description="Special diet or eating needs, trouble swallowing and the alerts staff see at meals and on the eMAR."
      actions={
        canEdit && draft === null ? (
          <EditButton
            label="Edit diet and swallowing"
            onClick={() =>
              setDraft({
                diet: diet ?? "",
                dysphagia: health.dysphagia === true,
                alerts: alerts.join("\n"),
              })
            }
          />
        ) : null
      }
    >
      {draft ? (
        <div className="space-y-3">
          {dietField ? (
            <Textarea
              aria-label="Special diet or eating needs"
              rows={2}
              placeholder="e.g. diabetic, cut food into small pieces"
              value={draft.diet}
              onChange={(e) => setDraft({ ...draft, diet: e.target.value })}
            />
          ) : null}
          <div className="flex items-center gap-3">
            <Switch
              id="dysphagia"
              checked={draft.dysphagia}
              onCheckedChange={(v) => setDraft({ ...draft, dysphagia: v })}
            />
            <Label htmlFor="dysphagia" className="text-sm">
              Trouble swallowing (dysphagia)
            </Label>
          </div>
          {draft.dysphagia ? (
            <Textarea
              aria-label="Swallowing alerts"
              rows={3}
              placeholder="One alert per line, e.g. thickened liquids"
              value={draft.alerts}
              onChange={(e) => setDraft({ ...draft, alerts: e.target.value })}
            />
          ) : null}
        </div>
      ) : (
        <>
          <FieldGrid>
            {dietField ? <Field label="Special diet">{diet}</Field> : null}
            <Field label="Trouble swallowing">{health.dysphagia ? "Yes" : "No"}</Field>
          </FieldGrid>
          {alerts.length ? (
            <ul className="mt-2 space-y-1">
              {alerts.map((a) => (
                <li
                  key={a}
                  className="flex items-center gap-1.5 text-sm font-medium text-[var(--hive-danger-fg)]"
                >
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {a}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {draft ? (
        <SaveBar
          onCancel={() => setDraft(null)}
          saving={save.isPending}
          saveLabel="Save diet and swallowing"
          onSave={() =>
            save.mutate({
              dysphagia: draft.dysphagia,
              swallowing_alerts: draft.dysphagia ? splitList(draft.alerts) : [],
            })
          }
        />
      ) : null}
    </SectionCard>
  );
}
