// The one contacts editor: guardian, emergency contacts, support coordinator,
// doctors and other providers, all in client_contacts. The face sheet, staff
// quick-info and shift page read the same rows.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccess } from "@/hooks/use-access";
import { useCurrentOrg } from "@/hooks/use-org";
import { ContactDialog } from "@/components/clients/dialogs/contact-dialog";
import {
  clientContactsKey,
  useClientContacts,
} from "@/components/clients/shared/hooks/use-client-contacts";
import {
  CONTACT_ROLES,
  CONTACT_ROLE_LABELS,
  contactsWithRole,
  type ClientContact,
  type ContactFields,
} from "@/lib/clients/contacts";
import {
  addClientContact,
  endClientContact,
  updateClientContact,
} from "@/lib/clients/contacts.functions";

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
}

export function ClientContactsCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const canEdit = useAccess().can("edit_client_records");
  const contactsQ = useClientContacts(clientId);
  const contacts = contactsQ.data ?? [];
  const [dialog, setDialog] = useState<{ contact: ClientContact | null } | null>(null);
  const addFn = useServerFn(addClientContact);
  const updateFn = useServerFn(updateClientContact);
  const endFn = useServerFn(endClientContact);

  const scope = () => {
    if (!org?.organization_id) throw new Error("No organization selected.");
    return { organizationId: org.organization_id, clientId };
  };
  const refresh = () => qc.invalidateQueries({ queryKey: clientContactsKey(clientId) });

  const save = useMutation({
    mutationFn: async ({ id, fields }: { id?: string; fields: ContactFields }) => {
      if (id) await updateFn({ data: { ...scope(), contactId: id, contact: fields } });
      else await addFn({ data: { ...scope(), contact: fields } });
    },
    onSuccess: () => {
      toast.success("Contact saved.");
      setDialog(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const end = useMutation({
    mutationFn: async (id: string) => endFn({ data: { ...scope(), contactId: id } }),
    onSuccess: () => {
      toast.success("Contact removed. It stays in the record history.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = CONTACT_ROLES.map((role) => ({ role, list: contactsWithRole(contacts, role) })).filter(
    (g) => g.list.length > 0,
  );

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-2.5 border-b border-border/60 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-tight">Contacts</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Guardian, emergency contacts, support coordinator, doctors and other providers.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setDialog({ contact: null })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          )}
        </div>
        <div className="px-5 py-2">
          {contactsQ.isLoading ? (
            <p className="py-2 text-sm text-muted-foreground">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No contacts on file.</p>
          ) : (
            groups.map((g) => (
              <section key={g.role} className="py-2">
                <h4 className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground/80">
                  {CONTACT_ROLE_LABELS[g.role]}
                </h4>
                <ul>
                  {g.list.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
                      <div className="grid h-8 w-8 flex-none place-items-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground">
                        {initials(c.name) || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 truncate text-sm font-semibold leading-tight">
                          {c.name}
                          {c.is_primary && <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-label="Main" />}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {[c.relationship, c.company, c.email].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="text-right text-xs tabular-nums text-muted-foreground">{c.phone || "—"}</div>
                      {canEdit && (
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit" onClick={() => setDialog({ contact: c })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove" disabled={end.isPending} onClick={() => end.mutate(c.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </CardContent>
      <ContactDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        contact={dialog?.contact ?? null}
        saving={save.isPending}
        onSave={(fields) => save.mutate({ id: dialog?.contact?.id, fields })}
      />
    </Card>
  );
}
