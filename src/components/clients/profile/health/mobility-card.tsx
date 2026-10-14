// Mobility: how they get around and the equipment they use
// (clients.mobility), edited right here (Client medical: Edit).

import { Accessibility } from "lucide-react";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { HealthList } from "./health-list";
import { useCanEditMedical, type ClientHealthRow } from "./use-client-health";

export function MobilityCard({ orgId, health }: { orgId: string; health: ClientHealthRow }) {
  const canEdit = useCanEditMedical();
  return (
    <SectionCard
      id="health-mobility"
      icon={Accessibility}
      tone="danger"
      title="Mobility"
      description="How they get around, transfers and the equipment they use."
    >
      <HealthList
        orgId={orgId}
        health={health}
        listKey="mobility"
        canEdit={canEdit}
        label="Needs and equipment"
      />
    </SectionCard>
  );
}
