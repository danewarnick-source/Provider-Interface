// Plan years: current, upcoming, ended (waiting on the new PCSP, with the
// day count) and past, with their dates. Reminders show 60 and 30 days
// before the plan year ends; from day 10 of waiting the office is asked to
// follow up (the same items appear in Needs attention).

import { useState } from "react";
import { CalendarClock, CalendarRange, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/clients/dates";
import { planReminder, planYearRows, strategiesDueOn, type PlanYearRow } from "@/lib/clients/plan-dates";
import type { ClientPlan } from "@/lib/clients/plans";
import { EditButton, SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState, StatusTag } from "@/components/clients/profile/cards/card-parts";
import { PlanDatesDialog } from "./plan-dates-dialog";

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

function kindBadge(r: PlanYearRow) {
  if (r.kind === "current") return <StatusTag tone="ok">Current</StatusTag>;
  if (r.kind === "upcoming") return <StatusTag tone="info">Upcoming</StatusTag>;
  if (r.kind === "waiting")
    return <StatusTag tone="danger">Ended, waiting {days(r.waitingDays ?? 0)}</StatusTag>;
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
  canEdit,
}: {
  orgId: string;
  clientId: string;
  plans: ClientPlan[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ClientPlan | "new" | null>(null);
  const rows = planYearRows(plans);
  const reminder = planReminder(plans);
  return (
    <SectionCard
      icon={CalendarRange}
      tone="ok"
      title="Plan years"
      description="Each PCSP plan year with its dates. Reminders start 60 days before it ends."
      actions={
        canEdit ? (
          <Button variant="outline" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add plan year
          </Button>
        ) : null
      }
    >
      <div className="space-y-3" data-testid="client-plan-years">
        {reminder ? (
          <div
            className="flex items-start gap-2 rounded-xl border border-hive-gold/50 bg-hive-gold-soft px-3 py-2 text-sm text-hive-ink"
            data-testid="plan-reminder"
          >
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {reminder.kind === "ending"
              ? `The plan year ends in ${days(reminder.days)} (${formatDate(reminder.endDate)}). Schedule the PCSP meeting.`
              : reminder.officeTask
                ? `Waiting ${days(reminder.days)} for the new PCSP. Office: follow up with the support coordinator.`
                : `Waiting ${days(reminder.days)} for the new PCSP.`}
          </div>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState>No plan year on file yet. Upload the PCSP or add a plan year.</EmptyState>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={r.plan.id} className="flex items-start gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {planName(r.plan)} {kindBadge(r)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Activated {formatDate(r.plan.activated_on)} · Meeting {formatDate(r.plan.meeting_date)}
                    {r.kind === "current" && r.daysLeft != null ? ` · ${days(r.daysLeft)} left` : ""}
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
      </div>
      {editing ? (
        <PlanDatesDialog orgId={orgId} clientId={clientId} plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </SectionCard>
  );
}
