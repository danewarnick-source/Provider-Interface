// Progress summaries: which of the client's codes owe one and how often
// (progress-summaries.ts cadence rules) and the summaries on file from the
// day the client started with the agency, each with its due date. Each
// opens in a side panel here, using the same editor as /dashboard/summaries
// (which stays the agency-wide list); closing it leaves the profile as it was.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileBarChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/clients/dates";
import {
  clientAgencyStart,
  currentSummaryPeriod,
  summariesSince,
  summaryButtonLabel,
  summaryDueRule,
  summaryPeriodName,
} from "@/lib/clients/plans/plan-summaries";
import { summariesOwed } from "@/lib/progress-summaries/progress-summaries";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { ReadOnlyTable } from "@/components/clients/profile/read-only-table";
import { SummaryEditor } from "@/components/summaries/summary-editor";
import { NewSummaryDialog } from "./new-summary-dialog";

const CADENCE: Record<string, string> = {
  quarterly: "quarterly",
  monthly: "monthly",
  financial: "monthly financial statement",
};

type SummaryRow = {
  id: string;
  period_kind: string | null;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  status: string | null;
};

export function SummariesPanel({
  clientId,
  clientName,
  orgId,
  codes,
}: {
  clientId: string;
  clientName: string;
  orgId?: string;
  codes: string[];
}) {
  const qc = useQueryClient();
  const orgName = useCurrentOrg().data?.organization_name ?? null;
  const [starting, setStarting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const queryKey = ["client-profile-summaries", orgId, clientId];
  const q = useQuery({
    enabled: !!orgId,
    queryKey,
    queryFn: async () => {
      const [summaries, client] = await Promise.all([
        supabase
          .from("client_progress_summaries")
          .select("id, period_kind, period_label, period_start, period_end, due_date, status")
          .eq("organization_id", orgId!)
          .eq("client_id", clientId)
          .order("period_end", { ascending: false })
          .limit(60),
        supabase
          .from("clients")
          .select("admission_date, hive_start_date, created_at")
          .eq("organization_id", orgId!)
          .eq("id", clientId)
          .maybeSingle(),
      ]);
      if (summaries.error) throw summaries.error;
      if (client.error) throw client.error;
      const start = client.data ? clientAgencyStart(client.data) : null;
      return { start, rows: summariesSince((summaries.data ?? []) as SummaryRow[], start) };
    },
  });
  const rows = q.data?.rows ?? [];
  const owed = summariesOwed(codes);
  const period = currentSummaryPeriod(owed.map((o) => o.cadence));
  const started = rows.some((r) => r.period_label === period.label);
  const refresh = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["deadlines", "summaries", orgId] });
  };

  return (
    <SectionCard
      icon={FileBarChart}
      tone="info"
      title="Progress summaries"
      description="Progress summaries: quarterly or monthly reports to the support coordinator."
      actions={
        owed.length && !started ? (
          <Button onClick={() => setStarting(true)} disabled={!orgId}>
            Start {summaryPeriodName(period.label)} summary
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-1.5 pb-3 text-xs" data-testid="client-summaries-owed">
        {owed.length === 0 ? (
          <span className="text-muted-foreground">None of this client's codes owe a summary.</span>
        ) : (
          owed.map((o) => (
            <StatusTag key={o.code}>
              {o.code} · {CADENCE[o.cadence]}
              {o.upi ? " · enter in UPI" : ""}
            </StatusTag>
          ))
        )}
      </div>
      {q.data?.start ? (
        <p className="pb-2 text-xs text-muted-foreground" data-testid="client-summaries-since">
          Since {formatDate(q.data.start)}, when {clientName} started with the agency.
        </p>
      ) : null}
      <ReadOnlyTable
        loading={q.isLoading}
        empty="No progress summaries on file."
        rows={rows}
        columns={[
          {
            header: "Period",
            cell: (r) =>
              summaryPeriodName(r.period_label) ??
              `${formatDate(r.period_start)} – ${formatDate(r.period_end)}`,
          },
          {
            header: "Due",
            cell: (r) => (
              <span className="block">
                <span className="block font-medium text-hive-ink">{formatDate(r.due_date)}</span>
                {summaryDueRule(r.period_kind) ? (
                  <span className="block text-xs text-muted-foreground">
                    {summaryDueRule(r.period_kind)}
                  </span>
                ) : null}
              </span>
            ),
          },
          { header: "Cadence", cell: (r) => r.period_kind ?? "—" },
          { header: "Status", cell: (r) => r.status ?? "—" },
          {
            header: "",
            cell: (r) => (
              <Button variant="outline" onClick={() => setOpenId(r.id)}>
                {summaryButtonLabel(r)}
              </Button>
            ),
          },
        ]}
      />
      {starting && orgId ? (
        <NewSummaryDialog
          clientId={clientId}
          orgId={orgId}
          serviceCodes={codes}
          defaultKind={period.kind}
          onClose={() => setStarting(false)}
          onCreated={(id) => {
            refresh();
            setStarting(false);
            setOpenId(id);
          }}
        />
      ) : null}
      {openId && orgId ? (
        <SummaryEditor
          panel
          summaryId={openId}
          organizationId={orgId}
          orgName={orgName}
          clientName={clientName}
          onClose={() => {
            setOpenId(null);
            refresh();
          }}
        />
      ) : null}
    </SectionCard>
  );
}
