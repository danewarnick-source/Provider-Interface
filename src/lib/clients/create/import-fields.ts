// Extracted document fields as client autofill reads them: the field shape, the
// document types, the confidence threshold and forgiving readers for text,
// booleans, lists, dates and numbers. Pure.


export interface ExtractedField {
  field_key: string;
  field_group?: string | null;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_bool?: boolean | null;
  value_array?: string[] | null;
  value_json?: unknown;
  source_locator?: string | null;
  confidence?: number | null;
}

export type SourceDocumentType =
  | "pcsp"
  | "1056_budget"
  | "mar"
  | "bsp"
  | "immunization"
  | "allergy"
  | "dnr"
  | "polst"
  | "palliative"
  | "hospice"
  | "grievance_acknowledgment"
  | "hrc_approval"
  | "other";

export interface ApplyExtractedCtx {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  organizationId: string;
  clientId: string;
  fields: ExtractedField[];
  /** Authoritative source for per-domain conflict resolution. Optional. */
  sourceDocumentType?: SourceDocumentType;
  /** Optional importJob context so merge flags and audit rows can link back. */
  importJobId?: string | null;
  /** Optional audit hook — called for every silently-handled error. */
  onError?: (action: string, message: string) => Promise<void> | void;
  /** Tenant identity (codes_held + names/aliases) for code-routing. */
  tenant?: { codesHeld: string[]; names: string[] };
  /** Admin overrides from the review screen (code.bill_as_ours.* etc.). */
  overrides?: Record<string, boolean>;
}

export const CONFIDENCE_THRESHOLD = 0.6;

export function fieldText(f: ExtractedField): string | null {
  if (f.value_text && f.value_text.trim()) return f.value_text.trim();
  // Rescue: AI sometimes places single-value text into value_array (e.g. one
  // goal as ["Independent meal prep"]). Treat the joined array as the text.
  if (Array.isArray(f.value_array) && f.value_array.length) {
    const joined = f.value_array.map((s) => String(s).trim()).filter(Boolean).join("; ");
    if (joined) return joined;
  }
  // Rescue: value_json may carry { text: "..." } or a string.
  if (typeof f.value_json === "string" && f.value_json.trim()) return f.value_json.trim();
  const j = f.value_json as { text?: unknown } | null | undefined;
  if (j && typeof j.text === "string" && j.text.trim()) return j.text.trim();
  return null;
}
export function fieldBool(f: ExtractedField): boolean | null {
  if (typeof f.value_bool === "boolean") return f.value_bool;
  const j = f.value_json as { bool?: unknown } | null | undefined;
  if (j && typeof j.bool === "boolean") return j.bool;
  if (f.value_text) {
    const v = f.value_text.trim().toLowerCase();
    if (["true", "yes", "y"].includes(v)) return true;
    if (["false", "no", "n"].includes(v)) return false;
  }
  return null;
}
export function fieldArray(f: ExtractedField): string[] | null {
  if (Array.isArray(f.value_array) && f.value_array.length)
    return f.value_array.map((s) => s.trim()).filter(Boolean);
  const j = f.value_json as { array?: unknown } | null | undefined;
  if (j && Array.isArray(j.array))
    return (j.array as unknown[]).map((s) => String(s).trim()).filter(Boolean);
  if (f.value_text) {
    return f.value_text
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return null;
}
export function fieldDate(f: ExtractedField): string | null {
  if (f.value_date && /^\d{4}-\d{2}-\d{2}/.test(f.value_date))
    return f.value_date.slice(0, 10);
  if (f.value_text && /^\d{4}-\d{2}-\d{2}/.test(f.value_text))
    return f.value_text.slice(0, 10);
  return null;
}

// Forgiving numeric coercion — AI often returns "$18.50" or "3,120" as a
// string even when the prompt asks for a number. Returns null when no real
// number can be recovered; never returns NaN.
export function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function boolFromAny(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return ["true", "yes", "y", "1", "prn"].includes(v.trim().toLowerCase());
  return false;
}

/** What one autofill run shares with each of its passes (codes, meds, custom fields). */
export interface ImportRun {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  organizationId: string;
  clientId: string;
  /** Fields at or above the confidence threshold, and the first of each key. */
  ok: ExtractedField[];
  byKey: Map<string, ExtractedField>;
  sourceDocumentType: SourceDocumentType | null;
  autofilled: string[];
  suggested: string[];
  customCreated: string[];
  onError: (action: string, message: string) => Promise<void>;
  writeScalarConflict: (field: string, existing: unknown, incoming: unknown) => Promise<void>;
}
