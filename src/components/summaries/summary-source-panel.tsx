// The summary editor's left column (the period's source documentation) and
// its two banners: no approved documentation, and the PBA financial statement.

import { AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SummarySourceBundle } from "@/lib/progress-summaries.functions";
import { summaryCadenceLabel } from "@/lib/progress-summaries";
import { cn } from "@/lib/utils";

export function NoSourceBanner() {
  return (
    <div className="rounded border bg-red-50 px-3 py-2 text-sm text-red-800 flex gap-2">
      <AlertTriangle className="size-4 mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold">No approved documentation found for this period.</div>
        <div>Write the summary manually below. Nectar will not draft from missing data.</div>
      </div>
    </div>
  );
}

export function PbaPanel({
  status,
  onMarkComplete,
}: {
  status: string;
  onMarkComplete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded border bg-amber-50 px-3 py-2 text-sm text-amber-900 flex gap-2">
        <Receipt className="size-4 mt-0.5" />
        <div>
          <div className="font-semibold">Monthly financial statement (PBA)</div>
          <div>
            Generate the statement using the agency&apos;s PBA tooling, then finalize here and
            attest sent to the Support Coordinator. Nectar does not draft financial statements.
          </div>
        </div>
      </div>
      {status !== "finalized" && (
        <Button size="sm" onClick={onMarkComplete}>
          <CheckCircle2 className="size-4 mr-1" /> Mark statement ready
        </Button>
      )}
    </div>
  );
}

export function SourcePanel({ bundle }: { bundle: SummarySourceBundle }) {
  const {
    client,
    servicesInPeriod,
    dailyLogs,
    shiftReports,
    incidents,
    summary,
    goals,
    organization,
    staffNames,
    untaggedSourceCount,
  } = bundle;
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border p-3 text-xs space-y-1">
        <div className="font-semibold text-sm mb-1">Period &amp; packet</div>
        <div>
          <span className="text-muted-foreground">Person:</span> {client.first_name}{" "}
          {client.last_name}
        </div>
        <div>
          <span className="text-muted-foreground">Dates:</span> {summary.period_start} →{" "}
          {summary.period_end}
        </div>
        <div>
          <span className="text-muted-foreground">Services:</span>{" "}
          {servicesInPeriod.map((s) => s.service_code).join(", ") || "(none)"}
        </div>
        <div>
          <span className="text-muted-foreground">Provider:</span>{" "}
          {organization.legal_name || organization.name || "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Support Coordinator:</span>{" "}
          {client.support_coordinator?.name || "Not on file"}
        </div>
        <div>
          <span className="text-muted-foreground">Staff:</span> {staffNames.join(", ") || "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Cadence:</span>{" "}
          {summaryCadenceLabel(summary.period_kind, summary.service_codes)}
        </div>
        {untaggedSourceCount > 0 && (
          <div className={cn("mt-1 rounded px-2 py-1", "bg-amber-50 text-amber-900")}>
            {untaggedSourceCount} source(s) untagged for service code / goal — shown for review;
            Nectar will not invent codes.
          </div>
        )}
      </div>

      <div className="rounded-lg border p-3 text-xs space-y-1">
        <div className="font-semibold text-sm mb-1">PCSP goals ({goals.length})</div>
        {goals.length === 0 ? (
          <div className="text-muted-foreground">No PCSP goals on record.</div>
        ) : (
          goals.map((g) => (
            <div key={g.id}>
              • {g.goal}
              {g.job_codes.length > 0 && (
                <span className="text-muted-foreground"> ({g.job_codes.join(", ")})</span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border p-3 text-xs space-y-2">
        <div className="font-semibold text-sm">Approved daily logs ({dailyLogs.length})</div>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {dailyLogs.length === 0 && <div className="text-muted-foreground">None.</div>}
          {dailyLogs.map((l) => (
            <div key={l.id} className="border-l-2 border-blue-300 pl-2">
              <div className="font-medium">
                {l.log_date} — {l.staff_name ?? "Staff"}
              </div>
              <div className="text-muted-foreground">
                Goals: {l.pcsp_goals_addressed.join(" | ") || "(none)"}
              </div>
              <div className="whitespace-pre-wrap">{l.narrative}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-3 text-xs space-y-2">
        <div className="font-semibold text-sm">Submitted shift reports ({shiftReports.length})</div>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {shiftReports.length === 0 && <div className="text-muted-foreground">None.</div>}
          {shiftReports
            .filter((r) => r.narrative)
            .map((r) => (
              <div key={r.id} className="border-l-2 border-violet-300 pl-2">
                <div className="font-medium">
                  {r.created_at.slice(0, 10)} — {r.staff_name ?? "Staff"}
                  {r.service_code ? ` · ${r.service_code}` : " · untagged"}
                </div>
                <div className="whitespace-pre-wrap">{r.narrative}</div>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-lg border p-3 text-xs space-y-2">
        <div className="font-semibold text-sm">Incidents ({incidents.length})</div>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {incidents.length === 0 && <div className="text-muted-foreground">None.</div>}
          {incidents.map((i) => (
            <div key={i.id} className="border-l-2 border-red-300 pl-2">
              <div className="font-medium">
                {i.incident_date} — #{i.report_number} ({i.incident_types.join(", ")})
              </div>
              <div className="whitespace-pre-wrap">{i.narrative_during}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
