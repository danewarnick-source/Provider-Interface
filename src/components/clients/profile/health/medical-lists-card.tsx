// Allergies, diagnoses and chronic conditions: lists on the clients row,
// added and edited right here (Client medical: Edit).

import { ClipboardPlus } from "lucide-react";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { HealthList } from "./health-list";
import { useCanEditMedical, type ClientHealthRow } from "./use-client-health";

export function MedicalListsCard({ orgId, health }: { orgId: string; health: ClientHealthRow }) {
  const canEdit = useCanEditMedical();
  return (
    <SectionCard
      id="health-conditions"
      icon={ClipboardPlus}
      tone="danger"
      title="Allergies, diagnoses and conditions"
      description="What they are allergic to and their diagnoses. The first diagnosis is the primary one."
    >
      <div className="space-y-5" data-testid="client-health-lists">
        <HealthList orgId={orgId} health={health} listKey="allergies" canEdit={canEdit} danger />
        <HealthList orgId={orgId} health={health} listKey="diagnoses" canEdit={canEdit} />
        <HealthList orgId={orgId} health={health} listKey="chronic_conditions" canEdit={canEdit} />
      </div>
    </SectionCard>
  );
}
