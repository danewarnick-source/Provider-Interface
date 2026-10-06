// Allergies, diagnoses and chronic conditions: comma or line separated
// lists on the clients row (Client medical: Edit to change).

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { splitList } from "@/lib/clients/health";
import { CardShell, GroupHeader } from "@/components/clients/profile/cards/card-shell";
import { useCanEditMedical, useSaveHealth, type ClientHealthRow } from "./use-client-health";

const LISTS = [
  { key: "allergies", label: "Allergies", empty: "No known allergies on file" },
  { key: "diagnoses", label: "Diagnoses", empty: "No diagnoses on file" },
  { key: "chronic_conditions", label: "Chronic conditions", empty: "None on file" },
] as const;
type ListKey = (typeof LISTS)[number]["key"];

export function MedicalListsCard({ orgId, health }: { orgId: string; health: ClientHealthRow }) {
  const save = useSaveHealth(orgId, health.id, () => setDraft(null));
  const canEdit = useCanEditMedical();
  const [draft, setDraft] = useState<Record<ListKey, string> | null>(null);
  const start = () =>
    setDraft({
      allergies: (health.allergies ?? []).join("\n"),
      diagnoses: (health.diagnoses ?? []).join("\n"),
      chronic_conditions: (health.chronic_conditions ?? []).join("\n"),
    });
  return (
    <CardShell
      title="Allergies, diagnoses and conditions"
      subtitle="The first diagnosis is the primary one."
      editing={draft !== null}
      canEdit={canEdit}
      onEdit={start}
      onCancel={() => setDraft(null)}
      saving={save.isPending}
      onSave={() =>
        draft &&
        save.mutate({
          allergies: splitList(draft.allergies),
          diagnoses: splitList(draft.diagnoses),
          chronic_conditions: splitList(draft.chronic_conditions),
        })
      }
    >
      <div data-testid="client-health-lists">
        {LISTS.map((l) => (
          <div key={l.key}>
            <GroupHeader>{l.label}</GroupHeader>
            {draft ? (
              <Textarea
                aria-label={l.label}
                rows={3}
                value={draft[l.key]}
                placeholder="One per line"
                onChange={(e) => setDraft({ ...draft, [l.key]: e.target.value })}
              />
            ) : (health[l.key] ?? []).length ? (
              <div className="flex flex-wrap gap-1.5">
                {(health[l.key] ?? []).map((v) => (
                  <Badge key={v} variant={l.key === "allergies" ? "destructive" : "outline"}>
                    {v}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{l.empty}</p>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}
