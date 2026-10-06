// Activity & notes: shifts, daily notes and incidents (incidents need
// Incidents: View), each row opening its record, plus office notes (Clients:
// Edit only).

import { useAccess } from "@/hooks/use-access";
import { ShiftsPanel } from "@/components/clients/profile/activity/shifts-panel";
import { DailyLogsPanel } from "@/components/clients/profile/activity/daily-logs-panel";
import { IncidentsPanel } from "@/components/clients/profile/activity/incidents-panel";
import { OfficeNotesCard } from "@/components/clients/profile/activity/office-notes-card";

export function ActivitySection({ clientId, orgId }: { clientId: string; orgId: string }) {
  const { canCategory } = useAccess();
  return (
    <div className="space-y-4" data-testid="client-section-activity">
      {canCategory("clients", "edit") ? <OfficeNotesCard clientId={clientId} orgId={orgId} /> : null}
      <ShiftsPanel clientId={clientId} orgId={orgId} />
      <DailyLogsPanel clientId={clientId} orgId={orgId} />
      {canCategory("incidents") ? <IncidentsPanel clientId={clientId} orgId={orgId} /> : null}
    </div>
  );
}
