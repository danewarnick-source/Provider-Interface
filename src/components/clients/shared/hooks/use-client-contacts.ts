import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { isRouteUuid } from "@/lib/route-uuid";
import {
  activeContacts,
  loadClientContacts,
  type ClientContact,
  type ContactFields,
} from "@/lib/clients/contacts";
import { addClientContact, updateClientContact } from "@/lib/clients/contacts.functions";

export const clientContactsKey = (clientId: string | undefined) => ["client-contacts", clientId] as const;

/** A client's active contacts (ended ones dropped), from client_contacts. */
export function useClientContacts(clientId: string | undefined) {
  return useQuery({
    enabled: isRouteUuid(clientId),
    queryKey: clientContactsKey(clientId),
    queryFn: async (): Promise<ClientContact[]> =>
      activeContacts(await loadClientContacts(supabase, [clientId!])),
  });
}

type ContactInput = Partial<ContactFields> & Pick<ContactFields, "role" | "name">;

/**
 * Save one contact: update `existing` (its other fields kept) or add a new one.
 * Refreshes the client's contacts afterwards.
 */
export function useSaveContact(clientId: string) {
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const addFn = useServerFn(addClientContact);
  const updateFn = useServerFn(updateClientContact);
  return async (existing: ClientContact | null, input: ContactInput): Promise<void> => {
    if (!org?.organization_id) throw new Error("No organization selected.");
    const scope = { organizationId: org.organization_id, clientId };
    const contact = {
      relationship: existing?.relationship ?? null,
      phone: existing?.phone ?? null,
      email: existing?.email ?? null,
      address: existing?.address ?? null,
      company: existing?.company ?? null,
      notes: existing?.notes ?? null,
      is_primary: existing?.is_primary ?? false,
      ...input,
    };
    if (existing) await updateFn({ data: { ...scope, contactId: existing.id, contact } });
    else await addFn({ data: { ...scope, contact } });
    await qc.invalidateQueries({ queryKey: clientContactsKey(clientId) });
  };
}
