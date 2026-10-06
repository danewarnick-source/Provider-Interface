// One contact in the Contacts list: initials, name (★ = main for the role),
// role and relationship, phone, and Edit / End for editors.

import { Pencil, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT_ROLE_LABELS, type ClientContact } from "@/lib/clients/contacts";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ContactRow({
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
  return (
    <li className="flex items-center gap-3 py-2.5" data-testid="client-contact-row">
      <div className="grid h-8 w-8 flex-none place-items-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground">
        {initials(c.name) || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate text-sm font-semibold leading-tight">
          {c.name}
          {c.is_primary && (
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-label="Main contact" />
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {[CONTACT_ROLE_LABELS[c.role], c.relationship, c.company, c.email]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <div className="text-right text-xs tabular-nums text-muted-foreground">{c.phone || "—"}</div>
      {canEdit && (
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`Edit ${c.name}`}
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`End ${c.name}`}
            disabled={ending}
            onClick={onEnd}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}
