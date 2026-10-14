// Writes the searchable sections of a published version (N3, Decision 8).
//
// Runs inside the publish server functions, so search is current when they
// return: every section is written at once (full-text search works right
// away) with an embedding where one was made inside the time budget. Sections
// still missing an embedding, and published documents never indexed (the six
// the N3 backfill published), are caught up by the next library change or by
// refreshLibraryIndex. An archived or replaced version's sections are kept
// and flagged with retired_at.
//
// Never logs document text; errors say which step failed, not what it read.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { gatewayEmbeddingsFetch } from "@/lib/ai-bedrock.server";
import {
  batches,
  embeddingInput,
  EMBED_CONCURRENCY,
  EMBED_DIMENSIONS,
  sectionRows,
  vectorLiteral,
  type SectionSource,
} from "./indexing";
import { looksCut } from "./library";
import { rereadStoredText } from "./text.server";
import { splitDocumentSections } from "./typed-sections";

type Db = SupabaseClient<Database>;

export interface IndexOptions {
  /** Make embeddings: the agency has Nectar and Ask on. */
  embed: boolean;
  /** Stop starting embedding calls and backlog documents after this time (epoch ms). */
  deadline: number;
}

export interface IndexableDocument {
  id: string;
  organization_id: string;
  version: number;
  title: string;
  raw_text: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
}

export const INDEXABLE_COLUMNS =
  "id, organization_id, version, title, raw_text, storage_bucket, storage_path, file_name, mime_type";

/** Embeddings for the inputs, in order (pgvector text); null where none was made in time. */
async function embedAll(
  orgId: string | null,
  inputs: string[],
  deadline: number,
): Promise<Array<string | null>> {
  const out: Array<string | null> = inputs.map(() => null);
  const queue = batches(inputs.length);
  let next = 0;
  const worker = async () => {
    while (next < queue.length && Date.now() < deadline) {
      const batch = queue[next++]!;
      const res = await gatewayEmbeddingsFetch(
        { input: batch.map((i) => inputs[i]!), dimensions: EMBED_DIMENSIONS },
        { orgId },
      );
      if (!res.ok) return;
      const json = (await res.json()) as { data?: Array<{ index: number; embedding: unknown }> };
      for (const item of json.data ?? []) {
        const at = batch[item.index];
        if (at !== undefined) out[at] = vectorLiteral(item.embedding);
      }
    }
  };
  await Promise.all(Array.from({ length: EMBED_CONCURRENCY }, worker));
  return out;
}

/** Takes a version's sections out of search. The rows stay, flagged with retired_at. */
export async function retireSections(
  db: Db,
  by: { documentId: string } | { stateDocumentId: string },
): Promise<void> {
  const column: "document_id" | "state_document_id" =
    "documentId" in by ? "document_id" : "state_document_id";
  const id = "documentId" in by ? by.documentId : by.stateDocumentId;
  const { error } = await db
    .from("knowledge_sections")
    .update({ retired_at: new Date().toISOString() })
    .eq(column, id)
    .is("retired_at", null);
  if (error) throw new Error("Could not take the old version out of Nectar search.");
}

type StoredText = Pick<
  IndexableDocument,
  "id" | "raw_text" | "storage_bucket" | "storage_path" | "file_name" | "mime_type"
>;

/** The text to index. Text the old ingest cut at 50,000 characters is re-read from its file and saved. */
async function fullText(
  db: Db,
  doc: StoredText,
  table: "nectar_documents" | "state_rule_documents",
) {
  const text = doc.raw_text ?? "";
  if (!looksCut(text)) return text;
  const reread = await rereadStoredText(db, doc).catch(() => null);
  if (!reread || reread.length <= text.length) return text;
  await db.from(table).update({ raw_text: reread }).eq("id", doc.id);
  return reread;
}

async function writeSections(
  db: Db,
  source: SectionSource,
  text: string,
  mimeType: string | null,
  orgId: string | null,
  opts: IndexOptions,
) {
  const sections = splitDocumentSections(text, mimeType);
  const vectors = opts.embed
    ? await embedAll(
        orgId,
        sections.map((s) => embeddingInput(source.title, s)),
        opts.deadline,
      )
    : [];
  const rows = sectionRows(source, sections, vectors);
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db.from("knowledge_sections").insert(rows.slice(i, i + 100));
    if (error) throw new Error("Could not add the document to Nectar search.");
  }
  return { sections: rows.length, embedded: rows.filter((r) => r.embedding).length };
}

/** Indexes one library document version (replacing any sections it already had in search). */
export async function indexLibraryVersion(db: Db, doc: IndexableDocument, opts: IndexOptions) {
  const text = await fullText(db, doc, "nectar_documents");
  await retireSections(db, { documentId: doc.id });
  const source: SectionSource = {
    kind: "library",
    organizationId: doc.organization_id,
    documentId: doc.id,
    version: doc.version,
    title: doc.title,
  };
  return writeSections(db, source, text, doc.mime_type, doc.organization_id, opts);
}

/** Indexes one state rule version (hive executives; no agency, so only the account-wide rate limit). */
export async function indexStateRuleVersion(
  db: Db,
  rule: Omit<IndexableDocument, "organization_id" | "mime_type"> & { mime_type?: string | null },
  opts: IndexOptions,
) {
  const text = await fullText(
    db,
    { ...rule, mime_type: rule.mime_type ?? null },
    "state_rule_documents",
  );
  await retireSections(db, { stateDocumentId: rule.id });
  const source: SectionSource = {
    kind: "state",
    stateDocumentId: rule.id,
    version: rule.version,
    title: rule.title,
  };
  return writeSections(db, source, text, rule.mime_type ?? null, null, opts);
}

/** Embeds sections still missing one (this agency's, or one state rule's) before the deadline. */
export async function embedPendingSections(
  db: Db,
  scope: { organizationId: string } | { stateDocumentId: string },
  opts: IndexOptions,
): Promise<number> {
  if (!opts.embed || Date.now() >= opts.deadline) return 0;
  const base = db
    .from("knowledge_sections")
    .select("id, heading, body, document_id, state_document_id")
    .is("embedding", null)
    .is("retired_at", null)
    .limit(200);
  const { data: rows, error } =
    "organizationId" in scope
      ? await base.eq("organization_id", scope.organizationId)
      : await base.eq("state_document_id", scope.stateDocumentId);
  if (error || !rows?.length) return 0;
  const ids = (key: "document_id" | "state_document_id") => [
    ...new Set(rows.map((r) => r[key]).filter((id): id is string => !!id)),
  ];
  const titles = new Map<string, string>();
  const [docs, rules] = await Promise.all([
    ids("document_id").length
      ? db.from("nectar_documents").select("id, title").in("id", ids("document_id"))
      : null,
    ids("state_document_id").length
      ? db.from("state_rule_documents").select("id, title").in("id", ids("state_document_id"))
      : null,
  ]);
  for (const d of [...(docs?.data ?? []), ...(rules?.data ?? [])]) titles.set(d.id, d.title);
  const orgId = "organizationId" in scope ? scope.organizationId : null;
  const inputs = rows.map((r) =>
    embeddingInput(titles.get(r.document_id ?? r.state_document_id ?? "") ?? "", r),
  );
  const vectors = await embedAll(orgId, inputs, opts.deadline);
  let done = 0;
  for (const [i, row] of rows.entries()) {
    if (!vectors[i]) continue;
    const { error: upErr } = await db
      .from("knowledge_sections")
      .update({ embedding: vectors[i] })
      .eq("id", row.id);
    if (!upErr) done += 1;
  }
  return done;
}

/**
 * Published, current library documents of the agency with nothing in search
 * yet, indexed one by one until the deadline. Returns how many were indexed.
 */
export async function indexLibraryBacklog(
  db: Db,
  orgId: string,
  opts: IndexOptions,
): Promise<number> {
  const { data: docs, error } = await db
    .from("nectar_documents")
    .select("id, parse_status")
    .eq("organization_id", orgId)
    .eq("library_status", "published")
    .is("superseded_by", null)
    .not("library_group", "is", null);
  if (error || !docs?.length) return 0;
  let indexed = 0;
  for (const doc of docs) {
    if (Date.now() >= opts.deadline) break;
    if (doc.parse_status === "no_text" || doc.parse_status === "failed") continue;
    const { data: has } = await db
      .from("knowledge_sections")
      .select("id")
      .eq("document_id", doc.id)
      .is("retired_at", null)
      .limit(1);
    if (has?.length) continue;
    const { data: full } = await db
      .from("nectar_documents")
      .select(INDEXABLE_COLUMNS)
      .eq("id", doc.id)
      .maybeSingle();
    if (!full?.raw_text) continue;
    await indexLibraryVersion(db, full, opts);
    indexed += 1;
  }
  return indexed;
}
