// Contacts section: the one contacts list (client_contacts) with role
// filters — guardian, representative, emergency contacts, support
// coordinator, doctors and other providers. The face sheet, staff
// quick-info and shift page read the same rows. Contacts are ended, never
// deleted, so the record history stays.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAccess } from "@/hooks/use-access";
import { ContactDialog } from "@/components/clients/dialogs/contact-dialog";
import {
  clientContactsKey,
  useClientContacts,
} from "@/components/clients/shared/hooks/use-client-contacts";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import {
  CONTACT_FILTERS,
  CONTACT_FILTER_LABELS,
  contactsForFilter,
  contactsWithRole,
  type ClientContact,
  type ContactFields,
  type ContactFilter,
  type ContactRole,
} from "@/lib/clients/contacts";
import {
  addClientContact,
  endClientContact,
  updateClientContact,
} from "@/lib/clients/contacts.functions";
import { updateClient } from "@/lib/clients/writes.functions";
import { ContactRow } from "./contact-row";

const FILTER_ROLE: Record<ContactFilter, ContactRole> = {
  all: "emergency",
  family: "guardian",
  emergency: "emergency",
  coordinator: "support_coordinator",
  medical: "primary_doctor",
};

export function ContactsSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const qc = useQueryClient();
  const clientId = data.client.id;
  const canEdit = useAccess().canCategory("clients", "edit");
  const contactsQ = useClientContacts(clientId);
  const contacts = contactsQ.data ?? [];
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [dialog, setDialog] = useState<{ contact: ClientContact | null } | null>(null);
  const addFn = useServerFn(addClientContact);
  const updateFn = useServerFn(updateClientContact);
  const endFn = useServerFn(endClientContact);
  const updateClientFn = useServerFn(updateClient);
  const scope = { organizationId: orgId, clientId };
  const refresh = () => qc.invalidateQueries({ queryKey: clientContactsKey(clientId) });

  const save = useMutation({
    mutationFn: async ({ id, fields }: { id?: string; fields: ContactFields }) => {
      if (id) await updateFn({ data: { ...scope, contactId: id, contact: fields } });
      else await addFn({ data: { ...scope, contact: fields } });
    },
    onSuccess: () => {
      toast.success("Contact saved.");
      setDialog(null);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const end = useMutation({
    mutationFn: (id: string) => endFn({ data: { ...scope, contactId: id } }),
    onSuccess: () => {
      toast.success("Contact ended. It stays in the record history.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ownGuardian = useMutation({
    mutationFn: (value: boolean) =>
      updateClientFn({ data: { ...scope, patch: { is_own_guardian: value } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-profile"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const isOwn = data.client.is_own_guardian === true;
  const hasGuardian = contactsWithRole(contacts, "guardian").length > 0;
  const shown = contactsForFilter(contacts, filter);

  return (
    <div className="space-y-4" data-testid="client-section-contacts">
      <Card>
        <CardContent
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 p-4 text-sm",
            !isOwn && !hasGuardian && "text-amber-800 dark:text-amber-300",
          )}
          data-testid="client-guardian-note"
        >
          <span className="flex items-center gap-2">
            {isOwn || hasGuardian ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <AlertTriangle className="h-4 w-4" aria-hidden />
            )}
            {isOwn
              ? `${data.name} is their own guardian.`
              : hasGuardian
                ? `${data.name} has a guardian (listed below).`
                : `No guardian on file. Add the guardian, or mark ${data.name} as their own guardian.`}
          </span>
          {canEdit ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Their own guardian
              <Switch
                checked={isOwn}
                disabled={ownGuardian.isPending}
                onCheckedChange={(v) => ownGuardian.mutate(v)}
                aria-label="Their own guardian"
              />
            </label>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter contacts by role">
              {CONTACT_FILTERS.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "secondary" : "ghost"}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {CONTACT_FILTER_LABELS[f]}
                </Button>
              ))}
            </div>
            {canEdit ? (
              <Button size="sm" variant="outline" onClick={() => setDialog({ contact: null })}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add contact
              </Button>
            ) : null}
          </div>
          {contactsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts here yet.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {shown.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  canEdit={canEdit}
                  ending={end.isPending}
                  onEdit={() => setDialog({ contact: c })}
                  onEnd={() => window.confirm(`End ${c.name} as a contact?`) && end.mutate(c.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ContactDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        contact={dialog?.contact ?? null}
        defaultRole={FILTER_ROLE[filter]}
        saving={save.isPending}
        onSave={(fields) => save.mutate({ id: dialog?.contact?.id, fields })}
      />
    </div>
  );
}
