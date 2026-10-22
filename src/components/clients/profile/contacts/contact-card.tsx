// One contact as a card: initials tinted by role, the full name and one role
// tag, then relationship / company, phone, email, address and note each on
// their own wrapped line (nothing cut off). Call / Email (real tel: and
// mailto: links, only when there's a number or email) plus Edit and ⋯ for
// editors sit in one footer row pinned to the bottom, so cards in a row line
// up. Ending archives the contact; nothing is deleted.

import type { ReactNode } from "react";
import { Building2, Mail, MapPin, Phone, Star, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TONE_TILE } from "@/components/profile-shell/tones";
import { EditButton } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import {
  contactInitials,
  contactTag,
  contactTelHref,
  type ClientContact,
} from "@/lib/clients/contacts";

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <dt className="mt-0.5 shrink-0 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 flex-1 whitespace-pre-line break-words">{children}</dd>
    </div>
  );
}

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
  const sub = [c.relationship, c.company].filter(Boolean).join(" · ");
  const tel = contactTelHref(c.phone);
  const hasFooter = !!tel || !!c.email || canEdit;
  return (
    <li
      className="flex h-full min-w-0 flex-col gap-3 rounded-2xl border border-hive-border bg-hive-surface p-4"
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
          <p className="break-words font-semibold leading-tight text-hive-ink">
            {c.name}
            {c.is_primary ? (
              <Star
                className="ml-1 inline h-3 w-3 fill-hive-gold align-baseline text-hive-gold"
                aria-label="Main contact"
              />
            ) : null}
          </p>
          <StatusTag tone={tag.tone} className="mt-1.5">
            {tag.label}
          </StatusTag>
        </div>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm text-hive-ink">
        {sub ? (
          <Detail icon={Building2} label="Relationship and company">
            {sub}
          </Detail>
        ) : null}
        {c.phone ? (
          <Detail icon={Phone} label="Phone">
            <span className="tabular-nums">{c.phone}</span>
          </Detail>
        ) : null}
        {c.email ? (
          <Detail icon={Mail} label="Email">
            {c.email}
          </Detail>
        ) : null}
        {c.address ? (
          <Detail icon={MapPin} label="Address">
            {c.address}
          </Detail>
        ) : null}
      </dl>
      {c.notes ? (
        <p className="whitespace-pre-line break-words text-sm text-muted-foreground">{c.notes}</p>
      ) : null}
      {hasFooter ? (
        <div className="mt-auto flex items-center gap-2 border-t border-hive-border pt-3 max-md:[&_a]:min-h-11">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {tel ? (
              <Button variant="outline" asChild>
                <a href={tel} aria-label={`Call ${c.name}`}>
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
          </div>
          {canEdit ? (
            <div className="flex shrink-0 gap-2">
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
      ) : null}
    </li>
  );
}
