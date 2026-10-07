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

/** Is any PCSP on file for the client? (Drafting support strategies needs one.) */
export function useHasPcsp(clientId: string): boolean {
  const q = useQuery({
    queryKey: ["client-has-pcsp", clientId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("client_documents")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .ilike("document_type", "pcsp");
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    staleTime: 30_000,
  });
  return q.data === true;
}
