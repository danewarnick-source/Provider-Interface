// Allergies, diagnoses and chronic conditions: comma or line separated
// lists on the clients row (Client medical: Edit to change).

import { useState } from "react";
import { ClipboardPlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { splitList } from "@/lib/clients/health";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
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
    <SectionCard
      id="health-conditions"
      icon={ClipboardPlus}
      tone="danger"
      title="Allergies, diagnoses and conditions"
      description="What they are allergic to and their diagnoses. The first diagnosis is the primary one."
      actions={
        canEdit && draft === null ? (
          <EditButton label="Edit allergies, diagnoses and conditions" onClick={start} />
        ) : null
      }
    >
      <div className="space-y-4" data-testid="client-health-lists">
        {LISTS.map((l) => (
          <div key={l.key}>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{l.label}</p>
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
      {draft ? (
        <SaveBar
          onCancel={() => setDraft(null)}
          saving={save.isPending}
          saveLabel="Save health lists"
          onSave={() =>
            save.mutate({
              allergies: splitList(draft.allergies),
              diagnoses: splitList(draft.diagnoses),
              chronic_conditions: splitList(draft.chronic_conditions),
            })
          }
        />
      ) : null}
    </SectionCard>
  );
}
