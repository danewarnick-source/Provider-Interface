// The summary editor's left column (the period's evidence in full) and
// the PBA financial statement banner.

import { CheckCircle2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SummarySourceBundle } from "@/lib/progress-summaries.functions";
import { EVIDENCE_KIND_LABEL, groupEvidence, type SummaryEvidence } from "@/lib/progress-summary-doc";
import { summaryCadenceLabel } from "@/lib/progress-summaries";
import { cn } from "@/lib/utils";

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

function EvidenceCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: SummaryEvidence[];
  tone: string;
}) {
  return (
    <div className="rounded-lg border p-3 text-xs space-y-2">
      <div className="font-semibold text-sm">
        {title} ({items.length})
      </div>
      <div className="max-h-80 overflow-y-auto space-y-2">
        {items.length === 0 && <div className="text-muted-foreground">None.</div>}
        {items.map((e) => (
          <div key={e.id} className={cn("border-l-2 pl-2", tone)}>
            <div className="font-medium">
              {e.date} — {e.who ?? EVIDENCE_KIND_LABEL[e.kind]}
              {e.code ? ` · ${e.code}` : ""}
            </div>
            {e.labels.length > 0 && (
              <div className="text-muted-foreground">Goals: {e.labels.join(" | ")}</div>
            )}
            <div className="whitespace-pre-wrap">{e.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SourcePanel({ bundle }: { bundle: SummarySourceBundle }) {
  const { client, servicesInPeriod, evidence, summary, goals, organization, staffNames } = bundle;
  const general = groupEvidence(summary.include_goal_progress ? goals : [], evidence).general.length;
  const of = (...kinds: SummaryEvidence["kind"][]) => evidence.filter((e) => kinds.includes(e.kind));
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
          <span className="text-muted-foreground">Team members:</span> {staffNames.join(", ") || "—"}
        </div>
        <div>
          <span className="text-muted-foreground">Cadence:</span>{" "}
          {summaryCadenceLabel(summary.period_kind, summary.service_codes)}
        </div>
        {general > 0 && (
          <div className={cn("mt-1 rounded px-2 py-1", "bg-amber-50 text-amber-900")}>
            {general} log(s) or shift note(s) not tied to a goal — listed under General.
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

      <EvidenceCard title="Approved daily logs" items={of("daily_log")} tone="border-blue-300" />
      <EvidenceCard
        title="Submitted shift notes"
        items={of("shift_note", "shift_report")}
        tone="border-violet-300"
      />
      <EvidenceCard title="Incidents" items={of("incident")} tone="border-red-300" />
    </div>
  );
}
