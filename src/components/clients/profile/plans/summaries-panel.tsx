// Progress summaries: which of the client's codes owe one and how often
// (progress-summaries.ts cadence rules), the summaries on file, and
// "New summary".

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summariesOwed } from "@/lib/progress-summaries";
import { ReadOnlyTable } from "@/components/clients/profile/read-only-table";

const CADENCE: Record<string, string> = {
  quarterly: "quarterly",
  monthly: "monthly",
  financial: "monthly financial statement",
};
import { NewSummaryDialog } from "./new-summary-dialog";

export function SummariesPanel({
  clientId,
  orgId,
  codes,
}: {
  clientId: string;
  orgId?: string;
  codes: string[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    enabled: !!orgId,
    queryKey: ["client-profile-summaries", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_progress_summaries")
        .select(
          "id, summary_kind, period_kind, period_label, period_start, period_end, status, finalized_at, due_date",
        )
        .eq("organization_id", orgId!)
        .eq("client_id", clientId)
        .order("period_end", { ascending: false })
        .limit(60);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Progress summaries</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} disabled={!orgId}>
          New summary
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-wrap gap-1.5 px-6 pb-3 text-xs" data-testid="client-summaries-owed">
          {summariesOwed(codes).length === 0 ? (
            <span className="text-muted-foreground">None of this client's codes owe a summary.</span>
          ) : (
            summariesOwed(codes).map((o) => (
              <Badge key={o.code} variant="outline" className="font-normal">
                {o.code} · {CADENCE[o.cadence]}
                {o.upi ? " · enter in UPI" : ""}
              </Badge>
            ))
          )}
        </div>
        <ReadOnlyTable
          loading={q.isLoading}
          empty="No progress summaries on file."
          rows={q.data ?? []}
          columns={[
            {
              header: "Kind",
              cell: (r) => <Badge variant="outline">{r.summary_kind ?? "—"}</Badge>,
            },
            { header: "Cadence", cell: (r) => r.period_kind ?? "—" },
            {
              header: "Period",
              cell: (r) => r.period_label ?? `${r.period_start ?? "—"} → ${r.period_end ?? "—"}`,
            },
            { header: "Status", cell: (r) => r.status ?? "—" },
            {
              header: "Finalized",
              cell: (r) => (r.finalized_at ? new Date(r.finalized_at).toLocaleDateString() : "—"),
            },
            {
              header: "",
              cell: (r) => (
                <Button asChild size="sm" variant="outline">
                  <Link to="/dashboard/summaries" search={{ client: clientId, open: r.id }}>
                    {r.status === "finalized" ? "View" : "Open editor"}
                  </Link>
                </Button>
              ),
            },
          ]}
        />
      </CardContent>
      {open ? (
        <NewSummaryDialog
          clientId={clientId}
          orgId={orgId!}
          serviceCodes={codes}
          onClose={() => setOpen(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["client-profile-summaries", orgId, clientId] });
            qc.invalidateQueries({ queryKey: ["deadlines", "summaries", orgId] });
            setOpen(false);
          }}
        />
      ) : null}
    </Card>
  );
}
