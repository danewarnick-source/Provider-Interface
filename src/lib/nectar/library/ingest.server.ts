// Real storage, table and AI calls behind ingest.ts (runIngest). Server-only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { applyExtractedFieldsToClient } from "@/lib/client-import-schema";
import { parseDocumentWithAI } from "@/lib/document-extraction";
import type { IngestDeps } from "./ingest";

export type NectarDocumentRow = Tables<"nectar_documents">;

const BUCKET = "nectar-documents";

async function extractPdfText(base64: string): Promise<string> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

function decodeBase64Text(base64: string): string {
  try {
    return atob(base64);
  } catch {
    return "";
  }
}

export function ingestDeps(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
): IngestDeps<NectarDocumentRow> {
  return {
    requireMember: () => requireOrgMembership(supabase, userId, organizationId),
    upload: async (path, bytes, contentType) => {
      const upload = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: false });
      if (upload.error) throw new Error(`Upload failed: ${upload.error.message}`);
    },
    parentVersion: async (parentId) => {
      const { data: parent } = await supabase
        .from("nectar_documents")
        .select("version")
        .eq("id", parentId)
        .maybeSingle();
      return parent?.version ?? null;
    },
    markNotCurrent: async (documentId) => {
      await supabase.from("nectar_documents").update({ is_current: false }).eq("id", documentId);
    },
    uploader: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();
      return { id: userId, name: profile?.full_name ?? profile?.email ?? null };
    },
    insertDocument: async (row) => {
      const { data: doc, error } = await supabase
        .from("nectar_documents")
        .insert(row)
        .select("*")
        .single();
      if (error || !doc) throw new Error(error?.message ?? "Insert failed");
      return doc;
    },
    updateDocument: async (documentId, patch) => {
      await supabase.from("nectar_documents").update(patch).eq("id", documentId);
    },
    readText: async (source, base64) =>
      source === "pdf" ? extractPdfText(base64) : decodeBase64Text(base64),
    parseFields: (text, hint) => parseDocumentWithAI(text, hint, organizationId),
    insertFields: async (rows) => {
      await supabase.from("nectar_extracted_fields").insert(rows);
    },
    autofillClient: (clientId, fields) =>
      applyExtractedFieldsToClient({ supabase, organizationId, clientId, fields }),
    newId: () => crypto.randomUUID(),
    now: () => new Date().toISOString(),
  };
}
