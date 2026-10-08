// The client's documents as Nectar reads them, shared by "About <first name>"
// and Must-knows: the current files in the Client file (with the caller's
// RLS-scoped client), their page texts, and one JSON request to Nectar.

import type { SupabaseClient } from "@supabase/supabase-js";
import { pdfToLayout, type UnpdfLike } from "./pcsp/layout";
import { rows } from "./list-queries";
import { unreadableDocs, type AboutDoc, type AboutDocInfo } from "./about-me";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const MAX_DOCS = 12;
const MAX_BYTES = 20 * 1024 * 1024;

type DocRow = {
  id: string;
  document_type: string | null;
  file_name: string | null;
  storage_path: string | null;
  uploaded_at: string | null;
};

/** The client's current documents in the Client file (archived and replaced ones left out). */
async function clientDocRows(sb: Sb, orgId: string, clientId: string): Promise<DocRow[]> {
  return rows<DocRow>(
    sb
      .from("client_documents")
      .select("id, document_type, file_name, storage_path, uploaded_at")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .is("archived_at", null)
      .neq("status", "outdated")
      .order("uploaded_at", { ascending: false }),
  );
}

const info = (d: DocRow): AboutDocInfo => ({
  id: d.id,
  type: d.document_type,
  name: d.file_name,
  uploadedAt: d.uploaded_at,
});

/** The client's current documents, without their text. */
export async function clientDocInfos(
  sb: Sb,
  orgId: string,
  clientId: string,
): Promise<AboutDocInfo[]> {
  return (await clientDocRows(sb, orgId, clientId)).map(info);
}

/** Page texts of one stored file: PDFs page by page, plain text as one page, anything else none. */
async function readPages(sb: Sb, d: DocRow): Promise<string[]> {
  if (!d.storage_path) return [];
  const { data: blob, error } = await sb.storage.from("client-documents").download(d.storage_path);
  if (error || !blob || blob.size > MAX_BYTES) return [];
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-") {
    try {
      const unpdf = (await import("unpdf")) as unknown as UnpdfLike;
      const pages = await pdfToLayout(bytes, unpdf);
      return pages.map((p) => p.lines.map((l) => l.text.trim()).join("\n"));
    } catch {
      return [];
    }
  }
  return /\.(txt|md|csv)$/i.test(d.file_name ?? "") ? [new TextDecoder().decode(bytes)] : [];
}

/** The newest documents with their page texts: readable ones, and names of the ones skipped (scans). */
export async function readClientDocs(
  sb: Sb,
  orgId: string,
  clientId: string,
): Promise<{ readable: AboutDoc[]; skipped: string[] }> {
  const docRows = (await clientDocRows(sb, orgId, clientId)).slice(0, MAX_DOCS);
  const docs: AboutDoc[] = await Promise.all(
    docRows.map(async (d) => ({ ...info(d), pages: await readPages(sb, d) })),
  );
  const unreadable = unreadableDocs(docs);
  return {
    readable: docs.filter((d) => !unreadable.includes(d)),
    skipped: unreadable.map((d) => d.name ?? "Untitled document"),
  };
}

/** One JSON request to Nectar; returns the reply text. `failed` is the message shown on error. */
export async function askNectarJson(
  orgId: string,
  system: string,
  user: string,
  failed: string,
): Promise<string> {
  const { gatewayFetch } = await import("@/lib/ai-bedrock.server");
  const res = await gatewayFetch(
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    },
    { orgId },
  );
  if (!res.ok) throw new Error(failed);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body?.choices?.[0]?.message?.content ?? "";
}
