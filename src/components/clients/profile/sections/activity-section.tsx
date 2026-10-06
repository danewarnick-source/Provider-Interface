// Activity & notes (rebuilt in a later step): recent shifts, daily logs and
// incidents (incidents need Incidents: View).

import { useAccess } from "@/hooks/use-access";
import {
  DailyLogsPanel,
  IncidentsPanel,
  ShiftsPanel,
} from "@/components/clients/profile/activity/activity-tables";

export function ActivitySection({ clientId, orgId }: { clientId: string; orgId: string }) {
  const canIncidents = useAccess().canCategory("incidents");
  return (
    <div className="space-y-4" data-testid="client-section-activity">
      <ShiftsPanel clientId={clientId} orgId={orgId} />
      <DailyLogsPanel clientId={clientId} orgId={orgId} />
      {canIncidents ? <IncidentsPanel clientId={clientId} orgId={orgId} /> : null}
    </div>
  );
}
