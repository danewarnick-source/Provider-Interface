// Overview section of the team member profile. Draws getMemberOverview and
// the caseload loader as they are — no counting here. Missing data is an
// honest empty state ("—" with a reason), never a made-up zero.

import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CircleAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceStatusChip } from "@/components/evidence/evidence-status-chip";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/team-members/badges";
import { isReadyAlone, readyAloneLabel } from "@/lib/team-members/readiness";
import type { AttentionItem, MemberOverview, ThisWeek } from "@/lib/team-members/overview";
import type { MemberCaseloadData } from "@/lib/team-members/caseload.functions";
import type { TeamMemberProfileTab } from "@/lib/team-members/profile-tabs";

const TONE_ROW: Record<AttentionItem["tone"], string> = {
  bad: "text-destructive",
  warn: "text-amber-700 dark:text-amber-300",
};

/** The full attention strip (Overview only; the shell draws a pill elsewhere). */
export function AttentionStrip({ items }: { items: AttentionItem[] }) {
  const router = useRouter();
  if (!items.length) return null;
  return (
    <Card
      className="border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5"
      data-testid="profile-attention"
    >
      <CardContent className="space-y-2 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
          {items.length} {items.length === 1 ? "thing needs" : "things need"} attention
        </p>
        <ul className="divide-y divide-border/60">
          {items.map((a) => (
            <li key={a.key} className="flex items-start justify-between gap-3 py-1.5 text-sm">
              <div className="min-w-0">
                <p className={cn("flex items-center gap-1.5 font-medium", TONE_ROW[a.tone])}>
                  <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{a.title}</span>
                </p>
                <p className="pl-5 text-xs text-muted-foreground">{a.detail}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() =>
                  void router.navigate({ href: a.href, replace: a.href.includes("?tab=") })
                }
              >
                Open <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function hoursText(h: number): string {
  return `${h.toLocaleString(undefined, { maximumFractionDigits: 2 })} h`;
}

const DAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"];

function Stat({
  label,
  value,
  reason,
  testId,
}: {
  label: string;
  value: string | null;
  reason: string | null;
  testId: string;
}) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value ?? "—"}</p>
      {value === null && reason ? (
        <p className="text-[11px] leading-tight text-muted-foreground">{reason}</p>
      ) : null}
    </div>
  );
}

function ThisWeekCard({ week, today }: { week: ThisWeek; today: string }) {
  const max = Math.max(1, ...(week.hours?.byDay.map((d) => d.hours) ?? [0]));
  return (
    <Card data-testid="overview-this-week">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">This week</CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatLocalDate(week.start)} – {formatLocalDate(week.end)}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="Hours clocked"
            value={week.hours ? hoursText(week.hours.clocked) : null}
            reason={week.reasons.hours}
            testId="overview-hours"
          />
          <Stat
            label="Notes"
            value={week.notes ? `${week.notes.submitted} of ${week.notes.needed}` : null}
            reason={week.reasons.notes}
            testId="overview-notes"
          />
          <Stat
            label="Overtime"
            value={week.overtimeHours === null ? null : hoursText(week.overtimeHours)}
            reason={week.reasons.hours}
            testId="overview-overtime"
          />
        </div>
        {week.hours ? (
          <div className="flex h-20 items-end gap-1.5" aria-label="Hours by day">
            {week.hours.byDay.map((d, i) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-full rounded-sm",
                    d.hours > 0 ? "bg-hive-gold" : "bg-muted",
                    d.date === today && "ring-1 ring-foreground/30",
                  )}
                  style={{ height: `${Math.max(4, (d.hours / max) * 56)}px` }}
                  title={`${formatLocalDate(d.date)}: ${hoursText(d.hours)}`}
                />
                <span className="text-[10px] text-muted-foreground">{DAY_LETTER[i]}</span>
              </div>
            ))}
          </div>
        ) : null}
        {week.hours && week.hours.stillClockedIn > 0 ? (
          <p
            className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"
            data-testid="overview-still-clocked-in"
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Still clocked in ({week.hours.stillClockedIn} open punch
            {week.hours.stillClockedIn === 1 ? "" : "es"}, not counted above)
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OverviewSection({
  overview,
  loading,
  error,
  caseload,
  caseloadLoading,
  onSelect,
}: {
  overview: MemberOverview | null | undefined;
  loading: boolean;
  error: string | null;
  caseload: MemberCaseloadData | null | undefined;
  caseloadLoading: boolean;
  onSelect: (tab: TeamMemberProfileTab) => void;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading overview…</p>;
  }
  if (error || !overview) {
    return (
      <Card className="border-destructive/30 bg-destructive/5" data-testid="overview-error">
        <CardContent className="p-4 text-sm text-destructive">
          Couldn't load the overview{error ? `: ${error}` : "."}
        </CardContent>
      </Card>
    );
  }
  const { readyToWork: ready, training } = overview;
  const readiness = (caseload?.assigned ?? []).map((c) => c.readiness);
  const readyAlone = readyAloneLabel(readiness);

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2" data-testid="profile-overview">
      <Card className="lg:row-span-2" data-testid="overview-ready">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ready to work</CardTitle>
          {readyAlone ? (
            <p
              className={cn(
                "text-xs",
                readiness.every(isReadyAlone)
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-amber-700 dark:text-amber-300",
              )}
            >
              {readyAlone}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {ready.noPack ? (
            <Empty>No evidence pack yet — nothing to check readiness against.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {ready.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{i.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {i.date ? (
                      <span className="text-xs text-muted-foreground">
                        {formatLocalDate(i.date)}
                      </span>
                    ) : null}
                    <EvidenceStatusChip
                      chip={{ kind: i.status, label: i.label, itemId: i.id }}
                      ariaLabel={`${i.title}: ${i.label}`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelect("file")}
            data-testid="overview-open-file"
          >
            Open team member file <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        </CardContent>
      </Card>

      <ThisWeekCard week={overview.thisWeek} today={overview.today} />

      <Card data-testid="overview-caseload">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Caseload</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onSelect("caseload")}
            data-testid="overview-manage-caseload"
          >
            Manage <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
          </Button>
        </CardHeader>
        <CardContent>
          {caseloadLoading ? (
            <Empty>Loading caseload…</Empty>
          ) : !caseload ? (
            <Empty>Caseload unavailable.</Empty>
          ) : caseload.assigned.length === 0 ? (
            <Empty>No clients assigned.</Empty>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {caseload.assigned.map((c) => (
                <li
                  key={c.clientId}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs"
                >
                  <span className="font-medium">{c.name}</span>
                  {c.codes.length ? (
                    <span className="text-muted-foreground">{c.codes.join(" · ")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card data-testid="overview-training">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Training</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onSelect("training")}
          >
            Open <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {training.item ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{training.item.title}</span>
              <span className="flex shrink-0 items-center gap-2">
                {training.item.date ? (
                  <span className="text-xs text-muted-foreground">
                    {formatLocalDate(training.item.date)}
                  </span>
                ) : null}
                <EvidenceStatusChip
                  chip={{ kind: training.item.status, label: training.item.label, itemId: null }}
                  ariaLabel={`${training.item.title}: ${training.item.label}`}
                />
              </span>
            </div>
          ) : (
            <Empty>Annual 12-hour training isn't on this person's evidence pack.</Empty>
          )}
          <p className="text-xs text-muted-foreground">{training.note}</p>
        </CardContent>
      </Card>

      <Card data-testid="overview-coming-up">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coming up</CardTitle>
          <p className="text-xs text-muted-foreground">Evidence dates in the next 60 days</p>
        </CardHeader>
        <CardContent>
          {overview.comingUp.length === 0 ? (
            <Empty>Nothing due in the next 60 days.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {overview.comingUp.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{c.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.label} {formatLocalDate(c.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
