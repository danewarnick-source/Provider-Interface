// Team: who works with this client on which codes (staff_assignments through
// setStaffClientCodes, the single write path), each one's "ready to work
// alone" (same rules as Team Members), the do-not-schedule list and the
// person-specific training staff take before working with the client.

import { GraduationCap } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import type { ClientOverview } from "@/lib/clients/overview";
import { ClientSpecificTrainingCard } from "@/components/clients/profile/client-specific-training-card";
import { TeamCodesCard } from "@/components/clients/profile/team/team-codes-card";
import { DoNotScheduleCard } from "@/components/clients/profile/team/do-not-schedule-card";
import { SectionCard } from "@/components/clients/profile/cards/section-card";

export function TeamSection({
  clientId,
  orgId,
  overview,
}: {
  clientId: string;
  orgId: string;
  overview: ClientOverview | null;
}) {
  const { canCategory } = useAccess();
  const canEditClients = canCategory("clients", "edit");
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-team">
      <TeamCodesCard
        orgId={orgId}
        clientId={clientId}
        canEdit={canCategory("staff_roster", "edit")}
        readiness={overview?.team ?? []}
      />
      <DoNotScheduleCard orgId={orgId} clientId={clientId} canEdit={canEditClients} />
      {canEditClients ? (
        <SectionCard
          icon={GraduationCap}
          tone="ok"
          title="Client-specific training"
          description="What team members learn about this client before working alone. Nectar drafts; a person approves."
        >
          <ClientSpecificTrainingCard clientId={clientId} />
        </SectionCard>
      ) : null}
    </div>
  );
}
