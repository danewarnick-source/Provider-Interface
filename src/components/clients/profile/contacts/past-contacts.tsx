// "Past contacts": ended contacts, kept for the record (never deleted).
// A link at the bottom of Contacts that opens the read-only list.

import { useState } from "react";
import { formatDate } from "@/lib/clients/dates";
import { contactTag, type ClientContact } from "@/lib/clients/contacts";

export function PastContacts({ contacts }: { contacts: ClientContact[] }) {
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
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
