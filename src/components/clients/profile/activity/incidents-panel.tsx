// Incidents involving this client (needs Incidents: View). Each row opens
// the incident in the Incidents queue, filtered to this client.

import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { incidentInvolvesClientOr } from "@/lib/incident-visibility";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadOnlyTable } from "@/components/clients/profile/read-only-table";

type IncidentRow = {
  id: string;
  incident_date: string | null;
  incident_types: string[] | null;
  status: string | null;
  is_abuse_neglect: boolean | null;
  is_fatality: boolean | null;
  report_number: string | null;
};

export function IncidentsPanel({ clientId, orgId }: { clientId: string; orgId: string }) {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["client-profile-incidents", orgId, clientId],
    queryFn: async (): Promise<IncidentRow[]> => {
      const { data, error } = await supabase
        .from("incident_reports")
        .select(
          "id, incident_date, incident_types, status, is_abuse_neglect, is_fatality, report_number",
        )
        .eq("organization_id", orgId)
        .or(incidentInvolvesClientOr(clientId))
        .order("incident_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as IncidentRow[];
    },
  });
  const open = () =>
    navigate({
      to: "/dashboard/hub/documentation",
      search: { tab: "incidents", client: clientId },
    });
  return (
    <Card data-testid="client-activity-incidents">
      <CardHeader>
        <CardTitle className="text-base">Incidents</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ReadOnlyTable
          loading={q.isLoading}
          empty="No incidents recorded."
          rows={q.data ?? []}
          onOpen={open}
          columns={[
            { header: "Date", cell: (r) => r.incident_date ?? "—" },
            {
              header: "Report #",
              cell: (r) => <code className="font-mono text-xs">{r.report_number ?? "—"}</code>,
            },
            { header: "Types", cell: (r) => (r.incident_types ?? []).join(", ") || "—" },
            {
              header: "Flags",
              cell: (r) => (
                <div className="flex gap-1">
                  {r.is_abuse_neglect ? <Badge variant="destructive">A/N</Badge> : null}
                  {r.is_fatality ? <Badge variant="destructive">Fatality</Badge> : null}
                  {!r.is_abuse_neglect && !r.is_fatality ? "—" : null}
                </div>
              ),
            },
            { header: "Status", cell: (r) => <Badge variant="outline">{r.status ?? "—"}</Badge> },
          ]}
        />
      </CardContent>
    </Card>
  );
}
