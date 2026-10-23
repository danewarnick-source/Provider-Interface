// "Past contacts": ended contacts, kept for the record (never deleted).
// A link at the bottom of Contacts that opens the list; editors can Restore
// one, which clears its end date and puts it back on the active list.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/clients/dates";
import { contactTag, type ClientContact } from "@/lib/clients/contacts/contacts";

export function PastContacts({
  contacts,
  canEdit,
  restoring,
  onRestore,
}: {
  contacts: ClientContact[];
  canEdit: boolean;
  restoring: boolean;
  onRestore: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (contacts.length === 0) return null;
  return (
    <div data-testid="client-past-contacts">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="min-h-10 text-sm font-medium text-[var(--hive-info-fg)] hover:underline max-md:min-h-11"
      >
        {open ? "Hide past contacts" : `Past contacts (${contacts.length})`}
      </button>
      {open ? (
        <ul className="mt-2 divide-y divide-hive-border rounded-2xl border border-hive-border bg-hive-surface px-4">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
              <span className="font-semibold text-hive-ink">{c.name}</span>
              <span className="text-muted-foreground">{contactTag(c.role).label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                Ended {formatDate(c.ended_on)}
              </span>
              {canEdit ? (
                <Button
                  variant="outline"
                  disabled={restoring}
                  onClick={() => onRestore(c.id)}
                  aria-label={`Restore ${c.name}`}
                  data-testid="client-past-contact-restore"
                >
                  Restore
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
