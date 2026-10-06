// Recent shifts (EVV timesheets) for this client. Each row opens the shift:
// times, team member, code, units, status and the shift note.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadOnlyTable } from "@/components/clients/profile/read-only-table";
import { useProfileNames } from "@/components/clients/shared/hooks/use-org-staff";
import { shiftHours } from "@/lib/clients/notes";
import { RecordDialog } from "./record-dialog";

const SHIFTS_LIMIT = 200;

type ShiftRow = {
  id: string;
  service_type_code: string | null;
  status: string | null;
  clock_in_timestamp: string | null;
  clock_out_timestamp: string | null;
  staff_id: string | null;
  billed_units: number | null;
  shift_note_text: string | null;
  review_status: string | null;
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

export function ShiftsPanel({ clientId, orgId }: { clientId: string; orgId: string }) {
  const [open, setOpen] = useState<ShiftRow | null>(null);
  const q = useQuery({
    queryKey: ["client-profile-shifts", orgId, clientId],
    queryFn: async (): Promise<ShiftRow[]> => {
      const { data, error } = await supabase
        .from("evv_timesheets")
        .select(
          "id, service_type_code, status, clock_in_timestamp, clock_out_timestamp, staff_id, billed_units, shift_note_text, review_status",
        )
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .order("clock_in_timestamp", { ascending: false })
        .limit(SHIFTS_LIMIT);
      if (error) throw error;
      return (data ?? []) as ShiftRow[];
    },
  });
  const rows = q.data ?? [];
  const names = useProfileNames(rows.map((r) => r.staff_id).filter((x): x is string => !!x)).data;
  const who = (id: string | null) => (id ? (names?.get(id) ?? "Team member") : "—");

  return (
    <Card data-testid="client-activity-shifts">
      <CardHeader>
        <CardTitle className="text-base">Shifts</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ReadOnlyTable
          loading={q.isLoading}
          empty="No shifts recorded for this client."
          rows={rows}
          onOpen={setOpen}
          columns={[
            {
              header: "Date",
              cell: (r) =>
                r.clock_in_timestamp ? new Date(r.clock_in_timestamp).toLocaleDateString() : "—",
            },
            { header: "Team member", cell: (r) => who(r.staff_id) },
            {
              header: "Code",
              cell: (r) => <code className="font-mono">{r.service_type_code ?? "—"}</code>,
            },
            {
              header: "Hours",
              cell: (r) => shiftHours(r.clock_in_timestamp, r.clock_out_timestamp) ?? "Open",
            },
            { header: "Status", cell: (r) => <Badge variant="outline">{r.status ?? "—"}</Badge> },
          ]}
        />
      </CardContent>
      {open ? (
        <RecordDialog
          open
          onOpenChange={(o) => !o && setOpen(null)}
          title={`Shift — ${open.service_type_code ?? "no code"}`}
          facts={[
            { label: "Team member", value: who(open.staff_id) },
            { label: "Code", value: open.service_type_code },
            { label: "Clock in", value: when(open.clock_in_timestamp) },
            { label: "Clock out", value: when(open.clock_out_timestamp) },
            {
              label: "Hours",
              value: shiftHours(open.clock_in_timestamp, open.clock_out_timestamp) ?? "Open",
            },
            { label: "Units billed", value: open.billed_units ?? "—" },
            { label: "Status", value: open.status },
            { label: "Review", value: open.review_status ?? "—" },
          ]}
          bodyLabel="Shift note"
          body={open.shift_note_text}
        />
      ) : null}
    </Card>
  );
}
