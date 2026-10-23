// Where medication uploads live in the private client-documents bucket and
// which files are accepted: label photos, the original-bottle approval and
// the psychotropic consent. Paths start with the agency id (the bucket's
// rules key off it): <orgId>/<clientId>/medications/<kind>-<id>-<name>.
// Pure; safe for browser and server.

export const MEDICATION_FILE_BUCKET = "client-documents";
export const MEDICATION_FILE_KINDS = ["label", "approval", "consent"] as const;
export type MedicationFileKind = (typeof MEDICATION_FILE_KINDS)[number];

/** 10 MB per file. */
export const MAX_MEDICATION_FILE_BYTES = 10 * 1024 * 1024;

export const MEDICATION_FILE_TYPES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export function medicationFolder(orgId: string, clientId: string): string {
  return `${orgId}/${clientId}/medications/`;
}

/** Letters, digits, dot, dash and underscore; at most 80 characters. */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(-80) || "file";
}

export function medicationFilePath(a: {
  orgId: string;
  clientId: string;
  kind: MedicationFileKind;
  id: string;
  fileName: string;
}): string {
  return `${medicationFolder(a.orgId, a.clientId)}${a.kind}-${a.id}-${safeFileName(a.fileName)}`;
}

/** True when `path` is one of this client's medication files (no "..", no other folder). */
export function isClientMedicationFile(path: string, orgId: string, clientId: string): boolean {
  const folder = medicationFolder(orgId, clientId);
  if (!path.startsWith(folder)) return false;
  const rest = path.slice(folder.length);
  return rest.length > 0 && !rest.includes("/") && !rest.includes("..");
}

/** Problem with an upload, or null when it is fine. */
export function medicationFileProblem(mime: string, bytes: number): string | null {
  if (!MEDICATION_FILE_TYPES[mime]) return "Upload a photo (JPG, PNG, WebP, HEIC) or a PDF.";
  if (bytes <= 0) return "The file is empty.";
  if (bytes > MAX_MEDICATION_FILE_BYTES) return "The file is over 10 MB.";
  return null;
}

/** Shown name for a stored path ("label-<id>-bottle.jpg" → "bottle.jpg"). */
export function medicationFileLabel(path: string | null | undefined): string {
  if (!path) return "";
  const base = path.slice(path.lastIndexOf("/") + 1);
  const m = /^(?:label|approval|consent)-[0-9a-f-]{36}-(.+)$/.exec(base);
  return m ? m[1] : base;
}
