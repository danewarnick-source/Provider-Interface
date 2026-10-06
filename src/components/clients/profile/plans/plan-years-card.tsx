// Plan years: current, upcoming, ended (waiting on the new PCSP, with the
// day count) and past, with their dates. Reminders show 60 and 30 days
// before the plan year ends; from day 10 of waiting the office is asked to
// follow up (the same items appear in Needs attention).

import { useState } from "react";
import { CalendarClock, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/clients/dates";
import { planReminder, planYearRows, strategiesDueOn, type PlanYearRow } from "@/lib/clients/plan-dates";
import type { ClientPlan } from "@/lib/clients/plans";
import { CardShell } from "@/components/clients/profile/cards/card-shell";
import { PlanDatesDialog } from "./plan-dates-dialog";

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

function kindBadge(r: PlanYearRow) {
  if (r.kind === "current") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Current</Badge>;
  if (r.kind === "upcoming") return <Badge variant="outline">Upcoming</Badge>;
  if (r.kind === "waiting")
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-800">
        Ended — waiting {days(r.waitingDays ?? 0)}
      </Badge>
    );
  return <Badge variant="secondary">Past</Badge>;
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
    <CardShell
      title="Plan years"
      headerRight={
        canEdit ? (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing("new")}>
            <Plus className="h-3.5 w-3.5" /> Add plan year
          </Button>
        ) : null
      }
    >
      <div className="space-y-3" data-testid="client-plan-years">
        {reminder ? (
          <div
            className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
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
          <p className="text-sm text-muted-foreground">No plan year on file yet — upload the PCSP or add one.</p>
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
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit plan dates" onClick={() => setEditing(r.plan)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing ? (
        <PlanDatesDialog orgId={orgId} clientId={clientId} plan={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
    </CardShell>
  );
}
