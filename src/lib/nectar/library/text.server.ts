// Reading the text of a Knowledge base file, server-side (N3).
//
// PDF text keeps its line breaks (page by page) so headings stay on their own
// lines for sections.ts; the old ingest flattened every PDF into one line.
// A file whose text comes out blank is kept with parse_status 'no_text'.
// Never logs file contents: errors carry the document id only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { LIBRARY_BUCKET, libraryFileKind, parseOutcome } from "./uploads";

type Db = SupabaseClient<Database>;

export type ReadResult =
  | { raw_text: string; parse_status: "parsed" | "no_text"; parse_error: null }
  | { raw_text: string; parse_status: "failed"; parse_error: string };

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).join("\n\n");
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const mod = await import("mammoth");
  const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return result.value ?? "";
}

/** The file's text and parse status. Unreadable formats give 'no_text'; a broken file gives 'failed'. */
export async function extractLibraryText(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string | null,
): Promise<ReadResult> {
  const kind = libraryFileKind(fileName, mimeType);
  try {
    if (kind === "pdf") return { ...parseOutcome(await pdfText(bytes)), parse_error: null };
    if (kind === "docx") return { ...parseOutcome(await docxText(bytes)), parse_error: null };
    if (kind === "text")
      return { ...parseOutcome(new TextDecoder().decode(bytes)), parse_error: null };
    return { ...parseOutcome(""), parse_error: null };
  } catch {
    return { raw_text: "", parse_status: "failed", parse_error: "The file could not be read." };
  }
}

/** A stored file's bytes, read with the caller's own client (storage policies apply). */
export async function readStoredFile(
  db: Db,
  path: string,
  bucket = LIBRARY_BUCKET,
): Promise<Uint8Array> {
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) throw new Error("Could not open the stored file.");
  return new Uint8Array(await data.arrayBuffer());
}

/** Saves typed text as the version's file, so every version has one (overwrites the same path). */
export async function storeTypedText(db: Db, path: string, text: string): Promise<number> {
  const bytes = new TextEncoder().encode(text);
  const { error } = await db.storage
    .from(LIBRARY_BUCKET)
    .upload(path, bytes, { contentType: "text/plain; charset=utf-8", upsert: true });
  if (error) throw new Error("Could not save the document text.");
  return bytes.byteLength;
}

/** Re-reads a stored file's text (used when old stored text was cut at 50,000 characters). */
export async function rereadStoredText(
  db: Db,
  file: {
    storage_bucket: string | null;
    storage_path: string | null;
    file_name: string | null;
    mime_type: string | null;
  },
): Promise<string | null> {
  if (!file.storage_path) return null;
  const bytes = await readStoredFile(db, file.storage_path, file.storage_bucket ?? LIBRARY_BUCKET);
  const read = await extractLibraryText(bytes, file.file_name ?? file.storage_path, file.mime_type);
  return read.parse_status === "parsed" ? read.raw_text : null;
}
