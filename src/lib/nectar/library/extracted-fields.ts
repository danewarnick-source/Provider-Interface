// AI-extracted document fields and the nectar_extracted_fields rows they become.
// Pure; used by the ingest pipeline (ingest.ts).

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined };

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
