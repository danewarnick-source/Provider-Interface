import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isRouteUuid } from "@/lib/route-uuid";
import { activeContacts, loadClientContacts, type ClientContact } from "@/lib/clients/contacts";

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

/** Every contact, ended ones too (the profile's "Past contacts"). */
export function useAllClientContacts(clientId: string | undefined) {
  return useQuery({
    enabled: isRouteUuid(clientId),
    queryKey: [...clientContactsKey(clientId), "all"],
    queryFn: (): Promise<ClientContact[]> => loadClientContacts(supabase, [clientId!]),
  });
}
