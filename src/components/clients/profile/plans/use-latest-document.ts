// The client's newest document of the given types (e.g. the signed HRC
// document or the BSP), or null.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLatestDocument(orgId: string, clientId: string, types: readonly string[]) {
  return useQuery({
    queryKey: ["client-latest-document", orgId, clientId, types.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, file_name, uploaded_at")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .in("document_type", [...types])
        .is("archived_at", null)
        .order("uploaded_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as { id: string; file_name: string; uploaded_at: string | null } | null;
    },
  });
}
