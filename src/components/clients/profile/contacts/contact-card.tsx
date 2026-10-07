// One contact as a card: initials tinted by role, name, organization or
// relationship, one role tag, a short note, and Call / Email (real tel: and
// mailto: links, only when there's a number or email) plus Edit and End for
// editors. Ending archives the contact; nothing is deleted.

import { Mail, Phone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TONE_TILE } from "@/components/profile-shell/tones";
import { EditButton } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { contactInitials, contactTag, type ClientContact } from "@/lib/clients/contacts";

export function ContactCard({
  contact: c,
  canEdit,
  ending,
  onEdit,
  onEnd,
}: {
  contact: ClientContact;
  canEdit: boolean;
  ending: boolean;
  onEdit: () => void;
  onEnd: () => void;
}) {
  const tag = contactTag(c.role);
  const sub = [c.company, c.relationship].filter(Boolean).join(" · ");
  return (
    <li
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-hive-border bg-hive-surface p-4"
      data-testid="client-contact-row"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold",
            TONE_TILE[tag.tone],
          )}
        >
          {contactInitials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate font-semibold leading-tight text-hive-ink">
            {c.name}
            {c.is_primary ? (
              <Star className="h-3 w-3 fill-hive-gold text-hive-gold" aria-label="Main contact" />
            ) : null}
          </p>
          {sub ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p> : null}
          {c.phone || c.email ? (
            <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
              {[c.phone, c.email].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <StatusTag tone={tag.tone} className="mt-1.5">
            {tag.label}
          </StatusTag>
        </div>
      </div>
      {c.notes ? <p className="line-clamp-2 text-sm text-muted-foreground">{c.notes}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 max-md:[&_a]:min-h-11">
        {c.phone ? (
          <Button variant="outline" asChild>
            <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${c.name}`}>
              <Phone className="h-4 w-4" /> Call
            </a>
          </Button>
        ) : null}
        {c.email ? (
          <Button variant="outline" asChild>
            <a href={`mailto:${c.email}`} aria-label={`Email ${c.name}`}>
              <Mail className="h-4 w-4" /> Email
            </a>
          </Button>
        ) : null}
        {canEdit ? (
          <div className="ml-auto flex gap-2">
            <EditButton label={`Edit ${c.name}`} onClick={onEdit} />
            <RowMenu
              label={`More actions for ${c.name}`}
              items={[
                { label: "End as a contact", danger: true, disabled: ending, onSelect: onEnd },
              ]}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}
