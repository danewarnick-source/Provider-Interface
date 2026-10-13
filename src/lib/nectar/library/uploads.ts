// Knowledge base file uploads (N3). Pure: no Supabase, no aliases, so
// node --test can import it. uploads.functions.ts hands out a signed upload
// URL; the browser sends the file straight to the nectar-documents bucket (no
// base64 through a server function) and then names the path when it saves
// the draft or new version.

export const LIBRARY_BUCKET = "nectar-documents";
export const LIBRARY_MAX_BYTES = 25 * 1024 * 1024;

export type LibraryFileKind = "pdf" | "docx" | "text";

const KIND_BY_EXTENSION: Record<string, LibraryFileKind> = {
  pdf: "pdf",
  docx: "docx",
  txt: "text",
  md: "text",
};

/** How to read a file's text; null = keep the file but there is no text to read (e.g. an old .doc). */
export function libraryFileKind(
  fileName: string,
  mimeType: string | null | undefined,
): LibraryFileKind | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (KIND_BY_EXTENSION[ext]) return KIND_BY_EXTENSION[ext]!;
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("officedocument.wordprocessingml")) return "docx";
  if (mime.startsWith("text/")) return "text";
  return null;
}

/** PDF, Word or text, up to 25 MB. Null when the file is fine. */
export function uploadProblem(file: {
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
}): string | null {
  if (!/\.(pdf|docx?|txt|md)$/i.test(file.fileName)) return "Upload a PDF, Word or text file.";
  if (file.sizeBytes <= 0) return "That file is empty.";
  if (file.sizeBytes > LIBRARY_MAX_BYTES) return "That file is larger than 25 MB.";
  return null;
}

export function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

/** Where a library file lives: "<org>/library/<id>-<name>". */
export function libraryObjectPath(organizationId: string, fileName: string, id: string): string {
  return `${organizationId}/library/${id}-${safeFileName(fileName)}`;
}

/** A path the browser sends back must be one this agency's upload URL handed out. */
export function isLibraryPathForOrg(path: string, organizationId: string): boolean {
  const prefix = `${organizationId}/library/`;
  return (
    path.startsWith(prefix) &&
    path.length > prefix.length &&
    !path.includes("..") &&
    !path.includes("//")
  );
}

/** The text a file gave, as a parse status: blank text means the file has no readable text. */
export function parseOutcome(text: string): {
  raw_text: string;
  parse_status: "parsed" | "no_text";
} {
  const clean = text.replaceAll("\u0000", "").trim();
  return clean
    ? { raw_text: clean, parse_status: "parsed" }
    : { raw_text: "", parse_status: "no_text" };
}
