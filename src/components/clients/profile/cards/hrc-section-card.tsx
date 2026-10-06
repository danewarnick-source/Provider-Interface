// Loads the client's documents and active rights restriction, then draws
// the HRC card (Plans section).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RestrictionRecord } from "@/lib/clients/hrc";
import type { ClientProfileRow } from "@/components/clients/profile/use-client-profile";
import type { DocRow } from "./code-document-cards";
import { HrcCard } from "./hrc-card";

/** Loads the client's documents and active restriction, then draws the HRC card. */
export function HrcSectionCard({ orgId, client }: { orgId: string; client: ClientProfileRow }) {
  const docsQ = useQuery({
    queryKey: ["client-hrc-docs", orgId, client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, document_type, file_name, storage_path, uploaded_at")
        .eq("organization_id", orgId)
        .eq("client_id", client.id);
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });
  const restrictionsQ = useQuery({
    queryKey: ["client-restrictions", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrc_restriction_records" as never)
        .select("*")
        .eq("client_id", client.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RestrictionRecord[];
    },
  });
  return (
    <HrcCard
      clientId={client.id}
      orgId={orgId}
      hasRestrictions={client.hr_applicable === true}
      docs={docsQ.data ?? []}
      restriction={restrictionsQ.data?.[0] ?? null}
    />
  );
}
