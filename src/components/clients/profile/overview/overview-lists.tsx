// Overview lists: what's coming up, the team (ready to work alone) and the
// last notes. Each row can open the section it belongs to.

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/clients/dates";
import type { ComingUpItem, OverviewNote, OverviewTeamMember } from "@/lib/clients/overview";
import type { ClientProfileSection } from "@/lib/clients/profile-sections";

function ListCard({
  title,
  testId,
  action,
  children,
}: {
  title: string;
  testId: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function OpenLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs text-primary hover:underline">
      {label}
    </button>
  );
}

function whenText(i: ComingUpItem): string {
  const day =
    i.days === 0
      ? "Today"
      : i.days === 1
        ? "Tomorrow"
        : formatDate(i.date, { weekday: "short", month: "short", day: "numeric" });
  if (!i.startsAt) return i.days < 0 ? `${formatDate(i.date)} (overdue)` : day;
  const time = new Date(i.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

export function ComingUpCard({
  items,
  onSelect,
}: {
  items: ComingUpItem[];
  onSelect: (s: ClientProfileSection) => void;
}) {
  return (
    <ListCard title="Coming up" testId="client-coming-up">
      {items.length === 0 ? (
        <Empty>Nothing in the next 30 days.</Empty>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <button
                type="button"
                className="min-w-0 truncate text-left hover:underline"
                onClick={() => onSelect(i.section)}
              >
                {i.label}
              </button>
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  i.days < 0 ? "font-medium text-destructive" : "text-muted-foreground",
                )}
              >
                {whenText(i)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
}

export function TeamCard({
  team,
  onSelect,
}: {
  team: OverviewTeamMember[];
  onSelect: (s: ClientProfileSection) => void;
}) {
  return (
    <ListCard
      title="Team"
      testId="client-team-card"
      action={<OpenLink label="Manage" onClick={() => onSelect("team")} />}
    >
      {team.length === 0 ? (
        <Empty>No team members assigned yet.</Empty>
      ) : (
        <ul className="divide-y divide-border/60">
          {team.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                {m.name}
                {m.codes.length ? (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    {m.codes.join(", ")}
                  </span>
                ) : null}
              </span>
              <span
                title={m.readinessLabel}
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  m.readyAlone
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
                )}
                data-testid="client-team-ready"
              >
                {m.readyAlone ? "Ready alone" : "Not ready alone"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
}

export function LastNotesCard({
  notes,
  onSelect,
}: {
  notes: OverviewNote[];
  onSelect: (s: ClientProfileSection) => void;
}) {
  return (
    <ListCard
      title="Last notes"
      testId="client-last-notes"
      action={<OpenLink label="All activity" onClick={() => onSelect("activity")} />}
    >
      {notes.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.key} className="text-sm">
              <p className="text-xs text-muted-foreground">
                {formatDate(n.date)} ·{" "}
                {n.kind === "daily" ? "Daily note" : `${n.code ?? "Shift"} note`}
              </p>
              <p className="line-clamp-3 whitespace-pre-wrap">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
}
