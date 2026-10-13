// Diet and swallowing: special diets (clients.diets), trouble swallowing
// (dysphagia) and the swallowing alerts staff see at meals and on the eMAR.
// All edited right here (Client medical: Edit).

import { Utensils } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { HealthList } from "./health-list";
import { useCanEditMedical, useSaveHealth, type ClientHealthRow } from "./use-client-health";

export function DietCard({ orgId, health }: { orgId: string; health: ClientHealthRow }) {
  const canEdit = useCanEditMedical();
  const save = useSaveHealth(orgId, health.id);
  const alerts = health.swallowing_alerts ?? [];
  const setDysphagia = (on: boolean) => {
    if (on) return save.mutate({ dysphagia: true });
    if (alerts.length && !window.confirm("Turn off trouble swallowing? Its alerts are cleared."))
      return;
    save.mutate({ dysphagia: false, swallowing_alerts: [] });
  };
  return (
    <SectionCard
      id="health-diet"
      icon={Utensils}
      tone="danger"
      title="Diet and swallowing"
      description="Special diets, trouble swallowing and the alerts staff see at meals and on the eMAR."
    >
      <div className="space-y-5" data-testid="client-health-diet">
        <HealthList orgId={orgId} health={health} listKey="diets" canEdit={canEdit} />
        <div className="flex items-center gap-3">
          {canEdit ? (
            <Switch
              id="dysphagia"
              checked={health.dysphagia === true}
              disabled={save.isPending}
              onCheckedChange={setDysphagia}
            />
          ) : null}
          <Label htmlFor="dysphagia" className="text-sm">
            Trouble swallowing (dysphagia){canEdit ? "" : `: ${health.dysphagia ? "Yes" : "No"}`}
          </Label>
        </div>
        {health.dysphagia ? (
          <HealthList
            orgId={orgId}
            health={health}
            listKey="swallowing_alerts"
            canEdit={canEdit}
            danger
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
