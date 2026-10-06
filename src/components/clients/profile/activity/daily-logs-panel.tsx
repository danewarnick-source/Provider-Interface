// Daily notes for this client. Each row opens the full note.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadOnlyTable } from "@/components/clients/profile/read-only-table";
import { useProfileNames } from "@/components/clients/shared/hooks/use-org-staff";
import { RecordDialog } from "./record-dialog";

export const DAILY_LOGS_LIMIT = 100;

type LogRow = {
  id: string;
  log_date: string | null;
  status: string | null;
  narrative: string | null;
  submitted_at: string | null;
  user_id: string | null;
  submitted_late: boolean | null;
  denial_reason: string | null;
};

export function DailyLogsPanel({ clientId, orgId }: { clientId: string; orgId: string }) {
  const [open, setOpen] = useState<LogRow | null>(null);
  const q = useQuery({
    queryKey: ["client-profile-logs", orgId, clientId],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, log_date, status, narrative, submitted_at, user_id, submitted_late, denial_reason")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .order("log_date", { ascending: false })
        .limit(DAILY_LOGS_LIMIT);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });
  const rows = q.data ?? [];
  const names = useProfileNames(rows.map((r) => r.user_id).filter((x): x is string => !!x)).data;
  const who = (id: string | null) => (id ? (names?.get(id) ?? "Team member") : "—");

  return (
    <Card data-testid="client-activity-logs">
      <CardHeader>
        <CardTitle className="text-base">Daily notes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ReadOnlyTable
          loading={q.isLoading}
          empty="No daily notes recorded."
          rows={rows}
          onOpen={setOpen}
          columns={[
            { header: "Date", cell: (r) => r.log_date ?? "—" },
            { header: "Written by", cell: (r) => who(r.user_id) },
            { header: "Status", cell: (r) => <Badge variant="outline">{r.status ?? "—"}</Badge> },
            {
              header: "Note",
              cell: (r) => <span className="line-clamp-2 max-w-md">{r.narrative ?? "—"}</span>,
            },
          ]}
        />
      </CardContent>
      {open ? (
        <RecordDialog
          open
          onOpenChange={(o) => !o && setOpen(null)}
          title={`Daily note — ${open.log_date ?? ""}`}
          facts={[
            { label: "Written by", value: who(open.user_id) },
            { label: "Status", value: open.status },
            {
              label: "Submitted",
              value: open.submitted_at ? new Date(open.submitted_at).toLocaleString() : "—",
            },
            { label: "Late", value: open.submitted_late ? "Yes" : "No" },
            ...(open.denial_reason ? [{ label: "Sent back because", value: open.denial_reason }] : []),
          ]}
          bodyLabel="Note"
          body={open.narrative}
        />
      ) : null}
    </Card>
  );
}
