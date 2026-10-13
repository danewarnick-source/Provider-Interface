// Upload + parse pipeline behind ingestDocument (nectar-documents.functions.ts).
// Pure: no Supabase, no aliases, so node --test can import it. ingest.server.ts
// wires storage, the nectar_documents tables, PDF text and the AI field parser.
//
// Rules (N1):
// - Only an owner or an agency-wide admin may upload, checked before anything
//   touches storage (the bucket's own policy is is_org_admin_or_manager).
// - Knowledge base uploads (owner kind company or state) keep their text for
//   Nectar but never run client-field extraction and never carry a client id.
// - Client autofill runs only for a client-profile upload: owner kind client,
//   a client id, and an autofill document type.

import { isAgencyAdmin, type AccessLevel, type AccessScope } from "../../access/levels.ts";

export const OWNER_KINDS = ["client", "staff", "company", "state", "other"] as const;

export const DOC_TYPES = [
  "pcsp",
  "1056_budget",
  "sow",
  "referral",
  "intake",
  "assessment",
  "certification",
  "training",
  "contract",
  "evv_report",
  "timesheet",
  "incident_report",
  "billing_record",
  "hrc_approval",
  "ol_residential_license",
  "ol_residential_certification",
  "ol_day_treatment_license",
  "ol_day_support_certification",
  "usor_approved_vendor",
  "usor_approved_vendor_job_development",
  "other",
] as const;

export const INGEST_FORBIDDEN_MESSAGE = "Only an owner or an agency-wide admin can upload documents.";

const AUTOFILL_DOC_TYPES = new Set(["pcsp", "1056_budget", "intake", "assessment"]);

/** Knowledge base uploads: agency-wide documents, never client records. */
export function isKnowledgeUpload(ownerKind: string): boolean {
  return ownerKind === "company" || ownerKind === "state";
}

export function shouldAutofillClient(
  ownerKind: string,
  clientId: string | null | undefined,
  documentType: string,
): boolean {
  return ownerKind === "client" && !!clientId && AUTOFILL_DOC_TYPES.has(documentType);
}

export function storageObjectPath(organizationId: string, fileName: string, id: string): string {
  return `${organizationId}/${id}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

/** Where readable text comes from; null = store the file but skip parsing. */
export function textSource(mimeType: string | null | undefined, fileName: string): "pdf" | "text" | null {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("pdf") || fileName.toLowerCase().endsWith(".pdf")) return "pdf";
  if (mime.startsWith("text/") || /\.(txt|csv|md|json|html?)$/i.test(fileName)) return "text";
  return null;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined };

export interface ParsedField {
  field_key: string;
  field_group?: string | null;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_bool?: boolean | null;
  value_array?: string[] | null;
  value_json?: JsonValue | null;
  source_locator?: string | null;
  confidence?: number | null;
}

export interface ParsedDocument {
  document_type?: string | null;
  fiscal_year?: string | null;
  medicaid_id?: string | null;
  fields?: ParsedField[];
}

export interface ExtractedFieldRow {
  organization_id: string;
  document_id: string;
  field_key: string;
  field_group: string | null;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_json: JsonValue | null;
  source_locator: string | null;
  confidence: number | null;
  status: "proposed";
}

/** nectar_extracted_fields rows; value_bool / value_array fold into value_json (no such columns). */
export function extractedFieldRows(
  organizationId: string,
  documentId: string,
  fields: ParsedField[],
): ExtractedFieldRow[] {
  return fields.map((f) => {
    let value_json: JsonValue | null = f.value_json ?? null;
    if (f.value_bool !== undefined && f.value_bool !== null) {
      value_json = { ...((value_json ?? {}) as Record<string, JsonValue>), bool: f.value_bool };
    }
    if (f.value_array && f.value_array.length) {
      value_json = { ...((value_json ?? {}) as Record<string, JsonValue>), array: f.value_array };
    }
    return {
      organization_id: organizationId,
      document_id: documentId,
      field_key: f.field_key,
      field_group: f.field_group ?? null,
      value_text: f.value_text ?? null,
      value_number: f.value_number ?? null,
      value_date: f.value_date ?? null,
      value_json,
      source_locator: f.source_locator ?? null,
      confidence: f.confidence ?? null,
      status: "proposed" as const,
    };
  });
}

export interface IngestInput {
  organizationId: string;
  ownerKind: (typeof OWNER_KINDS)[number];
  clientId?: string | null;
  staffId?: string | null;
  documentType: (typeof DOC_TYPES)[number];
  category?: string | null;
  title: string;
  fileName: string;
  mimeType?: string | null;
  fileBase64: string;
  fiscalYear?: string | null;
  effectiveStart?: string | null;
  effectiveEnd?: string | null;
  medicaidId?: string | null;
  tags: string[];
  externalIds?: Record<string, string>;
  parentDocumentId?: string | null;
  autoParse: boolean;
}

export type DocumentPatch = {
  parse_status?: string;
  parse_error?: string | null;
  parsed_at?: string;
  raw_text?: string;
  fiscal_year?: string | null;
  medicaid_id?: string | null;
};

export type NewDocumentRow = ReturnType<typeof documentRow>;

export interface IngestDeps<Doc extends { id: string }> {
  /** The caller's active membership in the organization; throws for a non-member. */
  requireMember: () => Promise<{ level: AccessLevel; scope: AccessScope }>;
  upload: (path: string, bytes: Uint8Array, contentType: string) => Promise<void>;
  parentVersion: (parentId: string) => Promise<number | null>;
  markNotCurrent: (documentId: string) => Promise<void>;
  /** The caller's user id and display name. */
  uploader: () => Promise<{ id: string; name: string | null }>;
  insertDocument: (row: NewDocumentRow) => Promise<Doc>;
  updateDocument: (documentId: string, patch: DocumentPatch) => Promise<void>;
  readText: (source: "pdf" | "text", base64: string) => Promise<string>;
  parseFields: (text: string, hint: string) => Promise<ParsedDocument>;
  insertFields: (rows: ExtractedFieldRow[]) => Promise<void>;
  autofillClient: (clientId: string, fields: ParsedField[]) => Promise<{ autofilled: string[]; suggested: string[] }>;
  newId: () => string;
  now: () => string;
}

export type IngestResult<Doc> = {
  document: Doc;
  extracted: ExtractedFieldRow[];
  autofilled?: string[];
  suggested?: string[];
  parseError?: string;
};

function documentRow(
  data: IngestInput,
  extra: { storagePath: string; size: number; version: number; uploader: { id: string; name: string | null } },
) {
  return {
    organization_id: data.organizationId,
    owner_kind: data.ownerKind,
    client_id: isKnowledgeUpload(data.ownerKind) ? null : (data.clientId ?? null),
    staff_id: data.staffId ?? null,
    document_type: data.documentType,
    category: data.category ?? null,
    title: data.title,
    parent_document_id: data.parentDocumentId ?? null,
    version: extra.version,
    is_current: true,
    effective_start: data.effectiveStart ?? null,
    effective_end: data.effectiveEnd ?? null,
    fiscal_year: data.fiscalYear ?? null,
    medicaid_id: data.medicaidId ?? null,
    external_ids: data.externalIds ?? {},
    tags: data.tags,
    storage_path: extra.storagePath,
    file_name: data.fileName,
    mime_type: data.mimeType ?? null,
    file_size_bytes: extra.size,
    source: "upload",
    parse_status: data.autoParse ? "parsing" : "skipped",
    uploaded_by: extra.uploader.id,
    uploaded_by_name: extra.uploader.name,
  };
}

export async function runIngest<Doc extends { id: string }>(
  data: IngestInput,
  deps: IngestDeps<Doc>,
): Promise<IngestResult<Doc>> {
  // 0. Owner or agency-wide admin, before anything touches storage.
  const member = await deps.requireMember();
  if (!isAgencyAdmin(member.level, member.scope)) {
    throw new Error(INGEST_FORBIDDEN_MESSAGE);
  }

  // 1. Upload to storage
  const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
  const storagePath = storageObjectPath(data.organizationId, data.fileName, deps.newId());
  await deps.upload(storagePath, bytes, data.mimeType ?? "application/octet-stream");

  // 2. Version chain: a parent document gets a new version; the old one stops being current.
  let version = 1;
  if (data.parentDocumentId) {
    version = ((await deps.parentVersion(data.parentDocumentId)) ?? 1) + 1;
    await deps.markNotCurrent(data.parentDocumentId);
  }

  // 3. Insert, with the uploader's display name
  const uploader = await deps.uploader();
  const doc = await deps.insertDocument(
    documentRow(data, { storagePath, size: bytes.byteLength, version, uploader }),
  );
  if (!data.autoParse) return { document: doc, extracted: [] };

  // 4. Parse
  try {
    const source = textSource(data.mimeType, data.fileName);
    if (!source) {
      // Images / scans / unsupported formats: keep the document, skip parsing.
      await deps.updateDocument(doc.id, {
        parse_status: "skipped",
        parse_error: "OCR not yet enabled for this format",
      });
      return { document: doc, extracted: [] };
    }
    const text = await deps.readText(source, data.fileBase64);

    // Knowledge base: keep the text for Nectar; no client-field extraction.
    if (isKnowledgeUpload(data.ownerKind)) {
      await deps.updateDocument(doc.id, {
        parse_status: "parsed",
        parsed_at: deps.now(),
        raw_text: text,
        parse_error: null,
      });
      return { document: doc, extracted: [] };
    }

    const ai = await deps.parseFields(text, `documentType=${data.documentType}`);
    const fields = ai.fields ?? [];
    const rows = extractedFieldRows(data.organizationId, doc.id, fields);
    if (rows.length) await deps.insertFields(rows);

    let autofill = { autofilled: [] as string[], suggested: [] as string[] };
    let autofillError: string | null = null;
    const effectiveDocType = (ai.document_type ?? data.documentType ?? "").toLowerCase();
    if (data.clientId && shouldAutofillClient(data.ownerKind, data.clientId, effectiveDocType)) {
      try {
        autofill = await deps.autofillClient(data.clientId, fields);
      } catch (err) {
        autofillError = (err as Error).message;
      }
    }

    await deps.updateDocument(doc.id, {
      parse_status: "parsed",
      parsed_at: deps.now(),
      raw_text: text,
      parse_error: autofillError ? `autofill: ${autofillError}` : null,
      // Backfill any fields the parser identified more confidently than the user input
      fiscal_year: data.fiscalYear ?? ai.fiscal_year ?? null,
      medicaid_id: data.medicaidId ?? ai.medicaid_id ?? null,
    });
    return {
      document: doc,
      extracted: rows,
      autofilled: autofill.autofilled,
      suggested: autofill.suggested,
    };
  } catch (err) {
    await deps.updateDocument(doc.id, { parse_status: "failed", parse_error: (err as Error).message });
    return { document: doc, extracted: [], parseError: (err as Error).message };
  }
}
