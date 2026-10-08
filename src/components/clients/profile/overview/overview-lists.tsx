// Overview lists: what's coming up (published shifts and due dates), the
// team (ready to work alone) and the last notes with their authors. Each row
// links to the section it belongs to.

import { ArrowRight, CalendarDays, NotebookPen, Users, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  comingUpWhen,
  noteHeading,
  type ComingUpItem,
  type OverviewNote,
  type OverviewTeamMember,
} from "@/lib/clients/overview";
import { CLIENT_SECTION_LABEL, type ClientProfileSection } from "@/lib/clients/profile-sections";
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

/** Small link to the section a row belongs to ("Open Activity"). */
function SectionLink({
  section,
  label,
  onSelect,
}: {
  section: ClientProfileSection;
  label?: string;
  onSelect: (s: ClientProfileSection) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(section)}
      className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-[var(--hive-info-fg)] hover:underline max-md:min-h-11"
    >
      {label ?? `Open ${CLIENT_SECTION_LABEL[section]}`}{" "}
      <ArrowRight className="h-3 w-3" aria-hidden />
    </button>
  );
}

function OpenButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      {label}
    </Button>
  );
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
      description="Published shifts, due dates and reviews in the next 30 days."
      testId="client-coming-up"
    >
      {items.length === 0 ? (
        <EmptyState>Nothing in the next 30 days.</EmptyState>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((i) => (
            <li
              key={i.key}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm"
              data-testid="client-coming-up-row"
            >
              <span className="min-w-0">
                <span className="font-medium text-hive-ink">{i.label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    i.days < 0 ? "font-medium text-destructive" : "text-muted-foreground",
                  )}
                >
                  {" "}
                  · {comingUpWhen(i)}
                </span>
              </span>
              <SectionLink section={i.section} onSelect={onSelect} />
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
      description="The newest daily and shift notes, and who wrote them."
      testId="client-last-notes"
    >
      {notes.length === 0 ? (
        <EmptyState>No notes yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-border/60">
          {notes.map((n) => (
            <li key={n.key} className="py-2 text-sm" data-testid="client-last-note">
              <p className="text-xs font-medium text-muted-foreground">{noteHeading(n)}</p>
              <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap">{n.text}</p>
              <SectionLink section="activity" label="Open in Activity" onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  );
}
