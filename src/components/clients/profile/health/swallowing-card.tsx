// Swallowing: dysphagia on/off and the alerts staff see at meals and on
// the eMAR (Client medical: Edit to change).

import { useState } from "react";
import { AlertTriangle, Utensils } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { splitList } from "@/lib/clients/health";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { Field, FieldGrid } from "@/components/clients/profile/cards/card-parts";
import { useCanEditMedical, useSaveHealth, type ClientHealthRow } from "./use-client-health";

export function SwallowingCard({ orgId, health }: { orgId: string; health: ClientHealthRow }) {
  const save = useSaveHealth(orgId, health.id, () => setDraft(null));
  const canEdit = useCanEditMedical();
  const [draft, setDraft] = useState<{ dysphagia: boolean; alerts: string } | null>(null);
  const alerts = health.swallowing_alerts ?? [];
  return (
    <SectionCard
      icon={Utensils}
      tone="danger"
      title="Swallowing"
      description="Trouble swallowing and the alerts staff see at meals and on the eMAR."
      actions={
        canEdit && draft === null ? (
          <EditButton
            label="Edit swallowing"
            onClick={() =>
              setDraft({ dysphagia: health.dysphagia === true, alerts: alerts.join("\n") })
            }
          />
        ) : null
      }
    >
      {draft ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              id="dysphagia"
              checked={draft.dysphagia}
              onCheckedChange={(v) => setDraft({ ...draft, dysphagia: v })}
            />
            <Label htmlFor="dysphagia" className="text-sm">
              Dysphagia (trouble swallowing)
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
            <Field label="Dysphagia">{health.dysphagia ? "Yes" : "No"}</Field>
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
          saveLabel="Save swallowing"
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
