// One team member on this client: initials, name, the codes they work, a
// readiness tag (Ready alone / Training needed), and for editors the pencil
// to change codes and "Take off the team" in the ⋯ menu.

import { EditButton } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { TONE_TILE } from "@/components/profile-shell/tones";
import { contactInitials } from "@/lib/clients/contacts";
import type { TeamCard } from "@/lib/clients/team";

export function TeamMemberCard({
  card,
  canEdit,
  busy,
  onEdit,
  onRemove,
}: {
  card: TeamCard;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-hive-border bg-hive-surface p-4"
      data-testid="client-team-member"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold ${TONE_TILE.ok}`}
        >
          {contactInitials(card.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight text-hive-ink">{card.name}</p>
          <StatusTag
            tone={card.readiness.tone}
            title={card.readiness.detail ?? undefined}
            className="mt-1.5"
          >
            {card.readiness.label}
          </StatusTag>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <EditButton label={`Change ${card.name}'s codes`} onClick={onEdit} />
            <RowMenu
              label={`More actions for ${card.name}`}
              items={[
                { label: "Take off the team", danger: true, disabled: busy, onSelect: onRemove },
              ]}
            />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Codes">
        {card.codes.map((c) => (
          <StatusTag key={c} tone="neutral" className="font-mono">
            {c}
          </StatusTag>
        ))}
      </div>
      {card.readiness.tone === "danger" && card.readiness.detail ? (
        <p className="text-xs text-muted-foreground">{card.readiness.detail}</p>
      ) : null}
    </li>
  );
}
