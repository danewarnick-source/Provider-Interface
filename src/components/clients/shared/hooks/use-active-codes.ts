import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadActiveCodes } from "@/lib/clients/codes";

/** client_id → active service codes (from client_billing_codes) for these clients. */
export function useActiveCodes(clientIds: readonly string[]) {
  const ids = [...new Set(clientIds)].sort();
  return useQuery({
    enabled: ids.length > 0,
    queryKey: ["client-active-codes", ids],
    queryFn: () => loadActiveCodes(supabase, ids),
  });
}

/** Active service codes for one client ([] while loading or when none). */
export function useClientActiveCodes(clientId: string | null | undefined): string[] {
  const q = useActiveCodes(clientId ? [clientId] : []);
  return (clientId && q.data?.get(clientId)) || [];
}
