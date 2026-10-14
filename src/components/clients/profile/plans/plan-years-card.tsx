// Plan years: the PCSP sets the dates. "Upload PCSP" is the main way in
// (the same upload and review as Goals and supports); hand entry is a small
// link for clients with no PCSP. The reminder uses the one PCSP wording
// (pcsp-status.ts) shared with Needs attention, the header and the list.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, todayYmd } from "@/lib/clients/dates";
import { planYearRows, strategiesDueOn, type PlanYearRow } from "@/lib/clients/plan-dates";
import {
  codesNeeding1056,
  expiredBadge,
  pcspSentence,
  pcspState,
  pcspWords,
} from "@/lib/clients/pcsp-status";
import type { ClientPlan } from "@/lib/clients/plans";
import { useClientBillingCodes } from "@/components/clients/shared/hooks/use-client-billing-codes";
import { EditButton, SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState, StatusTag } from "@/components/clients/profile/cards/card-parts";
import { PlanDatesDialog } from "./plan-dates-dialog";
import { PcspUploadButton } from "./pcsp-upload-button";

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
const NOTE = "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm text-hive-ink";

function kindBadge(r: PlanYearRow) {
  if (r.kind === "current") return <StatusTag tone="ok">Current</StatusTag>;
  if (r.kind === "upcoming") return <StatusTag tone="info">Upcoming</StatusTag>;
  if (r.kind === "waiting")
    return <StatusTag tone="danger">{expiredBadge(r.waitingDays ?? 0)}</StatusTag>;
  return <StatusTag>Past</StatusTag>;
}

function planName(p: ClientPlan): string {
  if (p.start_date || p.end_date) return `${formatDate(p.start_date)} – ${formatDate(p.end_date)}`;
  return p.label ? `${p.label} (no dates on file)` : "Dates not on file";
}

export function PlanYearsCard({
  orgId,
  clientId,
  plans,
  planCodes,
  canEdit,
}: {
  orgId: string;
  clientId: string;
  plans: ClientPlan[];
  /** The agency's codes on the current plan's supports (for the 1056 reminder). */
  planCodes: string[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ClientPlan | "new" | null>(null);
  const auths = useClientBillingCodes(clientId).data;
  const rows = planYearRows(plans);
  const words = pcspWords(pcspState(plans));
  const need1056 = auths && plans.length ? codesNeeding1056(planCodes, auths, todayYmd()) : [];
  const upload = (variant: "default" | "outline" = "default", testId = "pcsp-upload-input") =>
    canEdit ? (
      <PcspUploadButton
        clientId={clientId}
        orgId={orgId}
        variant={variant}
        inputTestId={testId}
      />
    ) : null;

  return (
    <SectionCard
      icon={CalendarRange}
      tone="ok"
      title="Plan years"
      description="Each PCSP plan year. Uploading the PCSP fills in its dates; reminders start 60 days before it ends."
      actions={rows.length ? upload() : null}
    >
      <div className="space-y-3" data-testid="client-plan-years">
        {words && rows.length ? (
          <div
            className={`${NOTE} border-hive-gold/50 bg-hive-gold-soft`}
            data-testid="plan-reminder"
          >
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{pcspSentence(words)}</span>
            {words.fix === "upload" ? upload("outline", "plan-reminder-pcsp-input") : null}
          </div>
        ) : null}
        {need1056.length ? (
          <div
            className={`${NOTE} border-hive-border bg-[var(--hive-info-soft)]`}
            data-testid="plan-next-1056"
          >
            <span className="min-w-0 flex-1">
              Next: add the new 1056 for {need1056.join(", ")}.
            </span>
            <Button asChild variant="outline">
              <Link
                to="/dashboard/clients/$clientId"
                params={{ clientId }}
                search={{ section: "services" }}
              >
                Open Services &amp; billing
              </Link>
            </Button>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState action={upload()}>No PCSP on file.</EmptyState>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.plan.id} className="flex items-start gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {planName(r.plan)} {kindBadge(r)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Activated {formatDate(r.plan.activated_on)} · Meeting{" "}
                    {formatDate(r.plan.meeting_date)}
                    {r.kind === "current" && r.daysLeft != null
                      ? ` · ${days(r.daysLeft)} left`
                      : ""}
                    {r.kind === "current" && strategiesDueOn(r.plan)
                      ? ` · Support strategies due ${formatDate(strategiesDueOn(r.plan))}`
                      : ""}
                  </div>
                </div>
                {canEdit ? (
                  <EditButton label="Edit plan dates" onClick={() => setEditing(r.plan)} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <button
            type="button"
            className="min-h-11 text-xs text-muted-foreground underline underline-offset-2 hover:text-hive-ink"
            onClick={() => setEditing("new")}
          >
            No PCSP? Enter plan dates by hand.
          </button>
        ) : null}
      </div>
      {editing ? (
        <PlanDatesDialog
          orgId={orgId}
          clientId={clientId}
          plan={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </SectionCard>
  );
}
