// A library version's file (N3): typed text saved as a .txt file, or a file
// the browser already uploaded with a signed URL (uploads.functions.ts).
// Every version has a file; its text goes in raw_text. A file with no
// readable text is kept with parse_status 'no_text'.

import { normalizeDraftText, typedTextFileName } from "./library";
import type { UploadedFile } from "./library-input";
import type { Db } from "./library-data.server";
import { extractLibraryText, readStoredFile, storeTypedText, type ReadResult } from "./text.server";
import { isLibraryPathForOrg, libraryObjectPath } from "./uploads";

export type FileFields = {
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number;
};

/** The uploader's display name for nectar_documents.uploaded_by_name. */
export async function displayName(db: Db, userId: string): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name?.trim() || data?.email || null;
}

/** Typed text becomes the version's .txt file; a draft's own .txt is overwritten in place. */
export async function typedFile(
  db: Db,
  orgId: string,
  title: string,
  text: string,
  reusePath?: string,
) {
  const clean = normalizeDraftText(text);
  const fileName = typedTextFileName(title);
  const path = reusePath ?? libraryObjectPath(orgId, fileName, crypto.randomUUID());
  const size = await storeTypedText(db, path, clean);
  const file: FileFields = {
    storage_path: path,
    file_name: fileName,
    mime_type: "text/plain",
    file_size_bytes: size,
  };
  const read: ReadResult = {
    raw_text: clean,
    parse_status: clean ? "parsed" : "no_text",
    parse_error: null,
  };
  return { ...file, ...read, parsed_at: new Date().toISOString() };
}

/** A file the browser uploaded. Its path must be one this agency's upload URL handed out. */
export function uploadedFile(orgId: string, upload: UploadedFile): FileFields {
  if (!isLibraryPathForOrg(upload.path, orgId)) {
    throw new Error("That upload isn't from this agency. Upload the file again.");
  }
  return {
    storage_path: upload.path,
    file_name: upload.fileName,
    mime_type: upload.mimeType ?? null,
    file_size_bytes: upload.sizeBytes,
  };
}

/** Reads an uploaded file's text into its row. Runs after the insert, so storage lets the caller read it. */
export async function readUploadedText(
  db: Db,
  documentId: string,
  file: FileFields,
): Promise<ReadResult> {
  let read: ReadResult;
  try {
    const bytes = await readStoredFile(db, file.storage_path);
    read = await extractLibraryText(bytes, file.file_name, file.mime_type);
  } catch {
    read = {
      raw_text: "",
      parse_status: "failed",
      parse_error: "The uploaded file could not be opened.",
    };
  }
  await db
    .from("nectar_documents")
    .update({ ...read, parsed_at: new Date().toISOString() })
    .eq("id", documentId);
  return read;
}
