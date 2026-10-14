// Data for the client's rights restrictions (HRRs): the HRRs, the client's
// HRC documents (to show each HRR's own file and any earlier loose uploads),
// names for the people who signed, and opening a stored file.

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { RestrictionRecord } from "@/lib/clients/hrc";

export const HRC_DOC_TYPES = ["hrc_approval", "human_rights"] as const;

export const clientRestrictionsKey = (clientId: string) =>
  ["client-restrictions", clientId] as const;

export function useClientRestrictions(clientId: string) {
  return useQuery({
    queryKey: clientRestrictionsKey(clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrc_restriction_records")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RestrictionRecord[];
    },
  });
}

export type HrcDocument = {
  id: string;
  file_name: string;
  storage_path: string | null;
  uploaded_at: string | null;
};

export const hrcDocumentsKey = (orgId: string, clientId: string) =>
  ["client-hrc-documents", orgId, clientId] as const;

/** The client's HRC documents, newest first (archived ones left out). */
export function useHrcDocuments(orgId: string, clientId: string) {
  return useQuery({
    queryKey: hrcDocumentsKey(orgId, clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, file_name, storage_path, uploaded_at")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .in("document_type", [...HRC_DOC_TYPES])
        .is("archived_at", null)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HrcDocument[];
    },
  });
}

/** user id → name, from profiles (never embedded from organization_members). */
export function usePeopleNames(ids: readonly (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((v): v is string => !!v))].sort();
  return useQuery({
    enabled: unique.length > 0,
    queryKey: ["people-names", unique.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, first_name, last_name")
        .in("id", unique);
      if (error) throw error;
      const out = new Map<string, string>();
      for (const p of data ?? []) {
        const name =
          p.full_name?.trim() ||
          `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
          "A team member";
        out.set(p.id, name);
      }
      return out;
    },
  });
}

/** Opens a file from client-documents in a new tab (short-lived signed link). */
export async function openClientDocument(path: string | null) {
  if (!path) {
    toast.error("This file isn't stored here.");
    return;
  }
  const { data, error } = await supabase.storage
    .from("client-documents")
    .createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    toast.error("Couldn't open the file.");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
