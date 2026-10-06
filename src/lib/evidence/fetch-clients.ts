import { supabase } from "@/integrations/supabase/client";
import { loadEvidenceClientPeople } from "./people.ts";
import type { EvidencePerson } from "./types.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/** Same browser + RLS path as the Clients page — owner/admin see the org roster. */
export async function fetchEvidenceClientPeople(
  organizationId: string,
): Promise<{ people: EvidencePerson[]; error: string | null }> {
  return loadEvidenceClientPeople((columns) =>
    sb
      .from("clients")
      .select(columns)
      .eq("organization_id", organizationId)
      .order("last_name", { ascending: true }),
  );
}
