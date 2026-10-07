// Contacts section: one grid of contact cards from client_contacts, guardian
// first, then the support coordinator, then everyone else by name. The face
// sheet, staff quick-info and shift page read the same rows. Contacts are
// ended (archived), never deleted; ended ones are under "Past contacts".

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAccess } from "@/hooks/use-access";
import { ContactDialog } from "@/components/clients/dialogs/contact-dialog";
import {
  clientContactsKey,
  useAllClientContacts,
} from "@/components/clients/shared/hooks/use-client-contacts";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import {
  activeContacts,
  contactCardOrder,
  pastContacts,
  type ClientContact,
  type ContactFields,
} from "@/lib/clients/contacts";
import {
  addClientContact,
  endClientContact,
  updateClientContact,
} from "@/lib/clients/contacts.functions";
import { guardianStatus } from "@/lib/clients/guardian";
import { updateClient } from "@/lib/clients/writes.functions";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState, StatusTag } from "@/components/clients/profile/cards/card-parts";
import { ContactCard } from "./contact-card";
import { PastContacts } from "./past-contacts";

export function ContactsSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const qc = useQueryClient();
  const clientId = data.client.id;
  const canEdit = useAccess().canCategory("clients", "edit");
  const contactsQ = useAllClientContacts(clientId);
  const all = contactsQ.data ?? [];
  const contacts = contactCardOrder(activeContacts(all));
  const past = pastContacts(all);
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
      toast.success("Contact ended. It's kept under Past contacts.");
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
  const guardian = guardianStatus(data.client.is_own_guardian, all);
  const note = {
    own: { tag: "Own guardian", text: `${data.name} is their own guardian.` },
    on_file: { tag: "Guardian on file", text: null },
    no_phone: {
      tag: "Guardian has no phone",
      text: "Add a phone for the guardian so staff can reach them.",
    },
    missing: {
      tag: "No guardian on file",
      text: `Add the guardian, or mark ${data.name} as their own guardian.`,
    },
  }[guardian.kind];
  const addButton = (
    <Button onClick={() => setDialog({ contact: null })}>
      <Plus className="h-4 w-4" /> Add contact
    </Button>
  );

  return (
    <div className="flex flex-col gap-5" data-testid="client-section-contacts">
      <SectionCard
        icon={UsersRound}
        tone="info"
        title="Contacts"
        description="Who to call, and for what. Guardian first."
        actions={canEdit ? addButton : null}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          data-testid="client-guardian-note"
        >
          <p className="flex flex-wrap items-center gap-2 text-sm text-hive-ink">
            <StatusTag tone={guardian.kind === "own" || guardian.kind === "on_file" ? "ok" : "danger"}>
              {note.tag}
            </StatusTag>
            {note.text}
          </p>
          {canEdit ? (
            <label className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
              Their own guardian
              <Switch
                checked={isOwn}
                disabled={ownGuardian.isPending}
                onCheckedChange={(v) => ownGuardian.mutate(v)}
                aria-label="Their own guardian"
              />
            </label>
          ) : null}
        </div>
      </SectionCard>

      {contactsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <EmptyState action={canEdit ? addButton : null}>
          No contacts yet. Add the guardian, support coordinator and doctors so staff know who
          to call.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {contacts.map((c) => (
            <ContactCard
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

      <PastContacts contacts={past} />

      <ContactDialog
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        contact={dialog?.contact ?? null}
        defaultRole="emergency"
        saving={save.isPending}
        onSave={(fields) => save.mutate({ id: dialog?.contact?.id, fields })}
      />
    </div>
  );
}
