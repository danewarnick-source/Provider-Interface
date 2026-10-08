// Team: the header and one card per team member (staff_assignments through
// setStaffClientCodes, the single write path) with their codes and "ready to
// work alone" (same rules as Team Members), then the do-not-schedule list
// with each reason, and the client-specific training.

import { GraduationCap } from "lucide-react";
import { useAccess } from "@/hooks/use-access";
import type { ClientOverview } from "@/lib/clients/overview";
import { ClientSpecificTrainingCard } from "@/components/clients/profile/client-specific-training-card";
import { TeamMembers } from "@/components/clients/profile/team/team-members";
import { DoNotScheduleCard } from "@/components/clients/profile/team/do-not-schedule-card";
import { SectionCard } from "@/components/clients/profile/cards/section-card";

export function TeamSection({
  clientId,
  orgId,
  firstName,
  overview,
}: {
  clientId: string;
  orgId: string;
  firstName: string;
  overview: ClientOverview | null;
}) {
  const { canCategory } = useAccess();
  const canEditClients = canCategory("clients", "edit");
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-team">
      <TeamMembers
        orgId={orgId}
        clientId={clientId}
        firstName={firstName}
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
