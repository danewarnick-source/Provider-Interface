// Activity & notes (interim until the Activity section is rebuilt): recent
// shifts, daily logs and incidents for this client, read-only.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { incidentInvolvesClientOr } from "@/lib/incident-visibility";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadOnlyTable } from "@/components/clients/profile/read-only-table";

export function ShiftsPanel({ clientId, orgId }: { clientId: string; orgId?: string }) {
  const q = useQuery({
    enabled: !!orgId,
    queryKey: ["client-profile-shifts", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evv_timesheets")
        .select(
          "id, service_type_code, status, clock_in_timestamp, clock_out_timestamp, staff_id, billed_units",
        )
        .eq("organization_id", orgId!)
        .eq("client_id", clientId)
        .order("clock_in_timestamp", { ascending: false })
        .limit(200);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent shifts (last 200)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ReadOnlyTable
          loading={q.isLoading}
          empty="No shifts recorded for this client."
          rows={q.data ?? []}
          columns={[
            {
              header: "Date",
              cell: (r) =>
                r.clock_in_timestamp ? new Date(r.clock_in_timestamp).toLocaleDateString() : "—",
            },
            {
              header: "Code",
              cell: (r) => <code className="font-mono">{r.service_type_code ?? "—"}</code>,
            },
            { header: "Status", cell: (r) => <Badge variant="outline">{r.status ?? "—"}</Badge> },
            { header: "Units", cell: (r) => r.billed_units ?? "—" },
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function DailyLogsPanel({ clientId, orgId }: { clientId: string; orgId?: string }) {
  const q = useQuery({
    enabled: !!orgId,
    queryKey: ["client-profile-logs", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, log_date, status, narrative, submitted_at")
        .eq("organization_id", orgId!)
        .eq("client_id", clientId)
        .order("log_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Daily logs (last 100)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ReadOnlyTable
          loading={q.isLoading}
          empty="No daily logs recorded."
          rows={q.data ?? []}
          columns={[
            { header: "Date", cell: (r) => r.log_date ?? "—" },
            { header: "Status", cell: (r) => <Badge variant="outline">{r.status ?? "—"}</Badge> },
            {
              header: "Submitted",
              cell: (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"),
            },
            {
              header: "Narrative",
              cell: (r) => <span className="line-clamp-2 max-w-md">{r.narrative ?? "—"}</span>,
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function IncidentsPanel({ clientId, orgId }: { clientId: string; orgId?: string }) {
  const q = useQuery({
    enabled: !!orgId,
    queryKey: ["client-profile-incidents", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_reports")
        .select(
          "id, incident_date, incident_types, status, is_abuse_neglect, is_fatality, report_number",
        )
        .eq("organization_id", orgId!)
        .or(incidentInvolvesClientOr(clientId))
        .order("incident_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Incidents</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ReadOnlyTable
          loading={q.isLoading}
          empty="No incidents recorded."
          rows={q.data ?? []}
          columns={[
            { header: "Date", cell: (r) => r.incident_date ?? "—" },
            {
              header: "Report #",
              cell: (r) => <code className="font-mono text-xs">{r.report_number ?? "—"}</code>,
            },
            {
              header: "Types",
              cell: (r) =>
                Array.isArray(r.incident_types)
                  ? (r.incident_types as string[]).join(", ") || "—"
                  : "—",
            },
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
