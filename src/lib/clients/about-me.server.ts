// Server side of "About <first name>": read the client's documents (with the
// caller's RLS-scoped client), ask Nectar for a draft, check every bullet's
// source in code (about-me.ts), and load/save the approved summary.
// Nectar only drafts; approveAboutMe needs a person and records who and when.

import type { SupabaseClient } from "@supabase/supabase-js";
import { pdfToLayout, type UnpdfLike } from "./pcsp/layout";
import { rows } from "./list-queries";
import { loadPeopleNames } from "./overview-team";
import { assertRowsChanged } from "./writes";
import {
  ABOUT_SYSTEM,
  aboutPrompt,
  checkAboutItems,
  hasNewKeyDocs,
  parseAboutReply,
  unreadableDocs,
  type AboutDoc,
  type AboutDocInfo,
  type AboutDraft,
  type AboutItem,
  type AboutSummary,
  type AboutView,
} from "./about-me";

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
async function clientDocs(sb: Sb, orgId: string, clientId: string): Promise<DocRow[]> {
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

export async function loadAboutView(sb: Sb, orgId: string, clientId: string): Promise<AboutView> {
  const [found, docs] = await Promise.all([
    rows<{
      items: unknown;
      drafted_by_nectar: boolean;
      approved_by: string;
      approved_at: string;
      based_on_doc_ids: string[] | null;
    }>(
      sb
        .from("client_about_me")
        .select("items, drafted_by_nectar, approved_by, approved_at, based_on_doc_ids")
        .eq("organization_id", orgId)
        .eq("client_id", clientId),
    ),
    clientDocs(sb, orgId, clientId),
  ]);
  const row = found[0];
  if (!row) return { summary: null, docs: docs.map(info), newDocs: false };
  const names = await loadPeopleNames(sb, [row.approved_by]);
  const summary: AboutSummary = {
    items: Array.isArray(row.items) ? (row.items as AboutItem[]) : [],
    draftedByNectar: row.drafted_by_nectar,
    approvedAt: row.approved_at,
    approverName: names.get(row.approved_by) ?? "Team member",
    basedOn: row.based_on_doc_ids ?? [],
  };
  const docInfo = docs.map(info);
  return { summary, docs: docInfo, newDocs: hasNewKeyDocs(summary, docInfo) };
}

const FAILED = "Nectar couldn't draft the summary right now. Try again in a minute.";

/** Nectar's draft from the client's readable documents. Saves nothing. */
export async function draftAboutMe(sb: Sb, orgId: string, clientId: string): Promise<AboutDraft> {
  const [client] = await rows<{ first_name: string | null }>(
    sb
      .from("clients")
      .select("first_name")
      .is("deleted_at", null)
      .eq("organization_id", orgId)
      .eq("id", clientId),
  );
  const docRows = (await clientDocs(sb, orgId, clientId)).slice(0, MAX_DOCS);
  const docs: AboutDoc[] = await Promise.all(
    docRows.map(async (d) => ({ ...info(d), pages: await readPages(sb, d) })),
  );
  const skipped = unreadableDocs(docs).map((d) => d.name ?? "Untitled document");
  const readable = docs.filter((d) => d.pages.some((p) => p.trim()));
  if (!readable.length) return { items: [], basedOn: [], skipped };

  const { gatewayFetch } = await import("@/lib/ai-bedrock.server");
  const res = await gatewayFetch(
    {
      messages: [
        { role: "system", content: ABOUT_SYSTEM },
        { role: "user", content: aboutPrompt(client?.first_name ?? "", readable) },
      ],
      response_format: { type: "json_object" },
    },
    { orgId },
  );
  if (!res.ok) throw new Error(FAILED);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const items = checkAboutItems(
    parseAboutReply(body?.choices?.[0]?.message?.content ?? ""),
    readable,
  );
  return { items, basedOn: readable.map((d) => d.id), skipped };
}

/** Save what a person approved. Every bullet's source must still be one of the client's documents. */
export async function approveAboutMe(
  sb: Sb,
  a: {
    orgId: string;
    clientId: string;
    userId: string;
    items: AboutItem[];
    basedOn: string[];
    draftedByNectar: boolean;
  },
): Promise<void> {
  const docs = await clientDocs(sb, a.orgId, a.clientId);
  const ids = new Set(docs.map((d) => d.id));
  const checked = checkAboutItems(
    a.items,
    docs.map((d) => ({ id: d.id, pages: [] })),
  );
  if (!checked.length) throw new Error("Keep at least one bullet before approving.");
  if (checked.length !== a.items.length)
    throw new Error(
      "Some bullets have no source in this client's files or mention medical details. Remove them, then approve.",
    );
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("client_about_me")
    .upsert(
      {
        organization_id: a.orgId,
        client_id: a.clientId,
        items: checked,
        drafted_by_nectar: a.draftedByNectar,
        approved_by: a.userId,
        approved_at: now,
        based_on_doc_ids: a.basedOn.filter((id) => ids.has(id)),
        updated_at: now,
      },
      { onConflict: "client_id" },
    )
    .select("id");
  if (error) throw new Error(error.message);
  assertRowsChanged(data as unknown[]);
}
