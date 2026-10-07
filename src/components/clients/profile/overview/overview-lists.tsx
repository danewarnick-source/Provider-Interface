// Overview lists: what's coming up, the team (ready to work alone) and the
// last notes. Each row can open the section it belongs to.

import { CalendarDays, NotebookPen, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/clients/dates";
import type { ComingUpItem, OverviewNote, OverviewTeamMember } from "@/lib/clients/overview";
import type { ClientProfileSection } from "@/lib/clients/profile-sections";
import { SectionCard, type CardTone } from "@/components/clients/profile/cards/section-card";
import { EmptyState, StatusTag } from "@/components/clients/profile/cards/card-parts";

function ListCard(props: {
  icon: LucideIcon;
  tone: CardTone;
  title: string;
  description: string;
  testId: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SectionCard
      icon={props.icon}
      tone={props.tone}
      title={props.title}
      description={props.description}
      actions={props.action}
      testId={props.testId}
    >
      {props.children}
    </SectionCard>
  );
}

function OpenButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      {label}
    </Button>
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
    <ListCard
      icon={CalendarDays}
      tone="neutral"
      title="Coming up"
      description="Shifts, due dates and reviews in the next 30 days."
      testId="client-coming-up"
    >
      {items.length === 0 ? (
        <EmptyState>Nothing in the next 30 days.</EmptyState>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <button
                type="button"
                className="min-h-8 min-w-0 truncate text-left hover:underline max-md:min-h-11"
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
      icon={Users}
      tone="ok"
      title="Team"
      description="Who works with them, and who is ready to work alone."
      testId="client-team-card"
      action={
        team.length ? <OpenButton label="Open Team" onClick={() => onSelect("team")} /> : null
      }
    >
      {team.length === 0 ? (
        <EmptyState action={<OpenButton label="Assign team" onClick={() => onSelect("team")} />}>
          No team members assigned yet.
        </EmptyState>
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
              <StatusTag
                tone={m.readyAlone ? "ok" : "profile"}
                title={m.readinessLabel}
                className="shrink-0"
                testId="client-team-ready"
              >
                {m.readyAlone ? "Ready alone" : "Not ready alone"}
              </StatusTag>
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
      icon={NotebookPen}
      tone="neutral"
      title="Last notes"
      description="The newest daily and shift notes."
      testId="client-last-notes"
      action={<OpenButton label="Open Activity" onClick={() => onSelect("activity")} />}
    >
      {notes.length === 0 ? (
        <EmptyState>No notes yet.</EmptyState>
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
