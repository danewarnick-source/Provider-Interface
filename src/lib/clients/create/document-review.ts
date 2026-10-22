// Review-then-apply for documents uploaded to a client (profile "Update from
// a document", and the BSP / MAR / DNR / POLST / palliative / hospice uploads
// in NectarAsk). Nectar reads the file and proposes values; nothing is written
// until a person ticks rows and clicks Apply selected. Pure: no Supabase, so
// node --test can import it. import-checklist.functions.ts wires the reads.

import { CONTACT_ROLE_LABELS, type ContactRole } from "../contacts/contacts.ts";
import {
  LEGACY_ALERT_KEY,
  LEGACY_CONTACT_KEYS,
  LEGACY_SINGLE_SOURCE_KEYS,
  type ContactPart,
} from "../legacy-fields.ts";
import { MEDICAL_CLIENT_FIELDS } from "../writes.ts";
import type { ManageClientAction } from "../guards.ts";

/** Client uploads always live in this private bucket; never taken from a request. */
export const CLIENT_DOCUMENTS_BUCKET = "client-documents";

/** The extracted field that carries one medication row (value_json). */
export const MEDICATION_FIELD_KEY = "client_medication";

/** Upload types Nectar reads and turns into a review list. */
export const REVIEWABLE_UPLOAD_TYPES: ReadonlySet<string> = new Set([
  "pcsp",
  "1056_budget",
  "mar",
  "bsp",
  "immunization",
  "allergy",
  "dnr",
  "polst",
  "palliative",
  "hospice",
  "other",
]);

/** Plural ask labels → the extractor's singular types; null when Nectar doesn't read it. */
export function reviewableUploadType(t: string | null | undefined): string | null {
  if (!t) return null;
  const v = t === "immunizations" ? "immunization" : t === "allergies" ? "allergy" : t;
  return REVIEWABLE_UPLOAD_TYPES.has(v) ? v : null;
}

/** Folder a client's uploads go in: <orgId>/<clientId>/<kind>/ (storage policy keys off the org folder). */
export function clientUploadFolder(orgId: string, clientId: string, kind: string): string {
  const safe = kind.replace(/[^\w-]+/g, "_") || "other";
  return `${orgId}/${clientId}/${safe}/`;
}

/** True when `path` is inside this client's folder (no traversal, no other client). */
export function isClientUploadPath(path: string, orgId: string, clientId: string): boolean {
  if (!path || path.startsWith("/") || path.includes("..") || path.includes("\\")) return false;
  const prefix = `${orgId}/${clientId}/`;
  return path.startsWith(prefix) && path.length > prefix.length;
}

type FieldKind = "text" | "bool" | "date" | "array";
export type ProfileFieldMeta =
  | { column: string; label: string; kind: FieldKind }
  | {
      contact: { role: ContactRole; part: ContactPart; slot: number };
      label: string;
      kind: "text";
    };

const CONTACT_FIELD_MAP: Record<string, ProfileFieldMeta> = Object.fromEntries(
  Object.entries(LEGACY_CONTACT_KEYS).map(([key, contact]) => [
    key,
    {
      contact,
      label: `${CONTACT_ROLE_LABELS[contact.role]}${contact.slot ? " #2" : ""} ${contact.part}`,
      kind: "text" as const,
    },
  ]),
);

// field_key (as emitted by parseDocumentWithAI) → where it lands + label.
// Matches the mappings in applyExtractedFieldsToClient. Anything not here
// (billing rows, goals, home, geofence, discharge date) is never applied
// from this review.
export const PROFILE_FIELD_MAP: Record<string, ProfileFieldMeta> = {
  ...CONTACT_FIELD_MAP,
  first_name: { column: "first_name", label: "First name", kind: "text" },
  last_name: { column: "last_name", label: "Last name", kind: "text" },
  dob: { column: "date_of_birth", label: "Date of birth", kind: "date" },
  medicaid_id: { column: "medicaid_id", label: "Medicaid ID", kind: "text" },
  phone: { column: "phone_number", label: "Phone", kind: "text" },
  physical_address: { column: "physical_address", label: "Physical address", kind: "text" },
  is_own_guardian: { column: "is_own_guardian", label: "Own guardian", kind: "bool" },
  [LEGACY_ALERT_KEY]: { column: "special_directions", label: "Must-knows for staff", kind: "text" },
  special_directions: { column: "special_directions", label: "Special directions", kind: "text" },
  dysphagia: { column: "dysphagia", label: "Dysphagia", kind: "bool" },
  allergies: { column: "allergies", label: "Allergies", kind: "array" },
  swallowing_alerts: { column: "swallowing_alerts", label: "Swallowing alerts", kind: "array" },
  dietary_restrictions: { column: "diets", label: "Diet", kind: "array" },
  mobility_notes: { column: "mobility", label: "Mobility", kind: "array" },
  adaptive_equipment: { column: "mobility", label: "Mobility (equipment)", kind: "array" },
  bsp_status: { column: "bsp_status", label: "BSP status", kind: "text" },
  [LEGACY_SINGLE_SOURCE_KEYS.insurance]: { column: "insurance", label: "Insurance", kind: "text" },
  housing_voucher: { column: "housing_voucher", label: "Housing voucher", kind: "text" },
  [LEGACY_SINGLE_SOURCE_KEYS.living]: {
    column: "about_me",
    label: "About me (preferred living)",
    kind: "text",
  },
  plan_year: { column: "plan_year", label: "Plan year", kind: "text" },
  disability_category: {
    column: "disability_category",
    label: "Disability category",
    kind: "text",
  },
  staff_ratio: { column: "staff_ratio", label: "Staff ratio", kind: "text" },
  level_of_need: { column: "level_of_need", label: "Level of need", kind: "text" },
  dnr_status: { column: "dnr_status", label: "DNR status", kind: "text" },
  dnr_location: { column: "dnr_location", label: "DNR location", kind: "text" },
  polst_status: { column: "polst_status", label: "POLST status", kind: "text" },
  palliative_care_status: {
    column: "palliative_care_status",
    label: "Palliative care status",
    kind: "text",
  },
  hospice_status: { column: "hospice_status", label: "Hospice status", kind: "text" },
  advanced_directives: {
    column: "advanced_directives",
    label: "Advanced directives",
    kind: "bool",
  },
  emergency_medical_treatment_authorization: {
    column: "emergency_medical_treatment_authorization",
    label: "Emergency medical treatment authorization",
    kind: "bool",
  },
  grievance_acknowledged: {
    column: "grievance_acknowledged",
    label: "Grievance acknowledged",
    kind: "bool",
  },
  grievance_signed_date: {
    column: "grievance_signed_date",
    label: "Grievance signed date",
    kind: "date",
  },
  diagnoses: { column: "diagnoses", label: "Diagnoses", kind: "array" },
  chronic_conditions: { column: "chronic_conditions", label: "Chronic conditions", kind: "array" },
  immunizations: { column: "immunizations", label: "Immunizations", kind: "array" },
  court_orders: { column: "court_orders", label: "Court orders", kind: "array" },
  rights_restrictions: {
    column: "rights_restrictions",
    label: "Rights restrictions",
    kind: "array",
  },
  [LEGACY_SINGLE_SOURCE_KEYS.activities]: {
    column: "about_me",
    label: "About me (activities)",
    kind: "array",
  },
  roommates: { column: "roommates", label: "Roommates", kind: "array" },
  personal_belongings_inventory: {
    column: "personal_belongings_inventory",
    label: "Personal belongings inventory",
    kind: "array",
  },
  admission_date: { column: "admission_date", label: "Start date", kind: "date" },
  form_1056_number: { column: "form_1056_number", label: "1056 form number", kind: "text" },
  form_1056_approved_date: {
    column: "form_1056_approved_date",
    label: "1056 approved date",
    kind: "date",
  },
};

/** clients columns the preview compares against. */
export const PROFILE_COLUMNS: readonly string[] = Array.from(
  new Set(Object.values(PROFILE_FIELD_MAP).flatMap((m) => ("column" in m ? [m.column] : []))),
);

export const REVIEW_CONFIDENCE_THRESHOLD = 0.6;

/** JSON a server function can return (the extractor's structured rows). */
export type ReviewJson =
  | string
  | number
  | boolean
  | null
  | ReviewJson[]
  | { [key: string]: ReviewJson };

export interface ReviewField {
  field_key: string;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_bool?: boolean | null;
  value_array?: string[] | null;
  value_json?: ReviewJson;
  confidence?: number | null;
}

export interface ReviewProposal {
  /** Unique row key (medications are "client_medication:<n>"). */
  field_key: string;
  label: string;
  incomingValue: string;
  currentValue: string | null;
  changed: boolean;
  confidence: number;
  /** What Apply selected sends back for this row. */
  field: ReviewField;
}

function isMedicalMeta(meta: ProfileFieldMeta): boolean {
  return "column" in meta && MEDICAL_CLIENT_FIELDS.has(meta.column);
}

/** True for a field that needs Client medical access (a medication or a medical column). */
export function isMedicalReviewField(fieldKey: string): boolean {
  if (fieldKey === MEDICATION_FIELD_KEY) return true;
  const meta = PROFILE_FIELD_MAP[fieldKey];
  return !!meta && isMedicalMeta(meta);
}

/**
 * Field keys Apply selected may write. Throws on anything else (billing
 * codes, goals, home, geofence…), so a crafted request can't use the review
 * to write records the review never showed.
 */
export function assertReviewableFields(fields: readonly { field_key: string }[]): void {
  const bad = fields
    .map((f) => f.field_key)
    .filter((k) => k !== MEDICATION_FIELD_KEY && !PROFILE_FIELD_MAP[k]);
  if (bad.length) {
    throw new Error(
      `These can't be applied from a document review: ${[...new Set(bad)].join(", ")}`,
    );
  }
}

/** Guard actions Apply selected needs for these fields. */
export function actionsForReviewedFields(
  fields: readonly { field_key: string }[],
): ManageClientAction[] {
  const actions: ManageClientAction[] = ["edit"];
  if (fields.some((f) => isMedicalReviewField(f.field_key))) actions.push("edit_medical");
  return actions;
}

function displayFromField(meta: { kind: FieldKind }, f: ReviewField): string {
  if (meta.kind === "bool") {
    if (f.value_bool === true) return "Yes";
    if (f.value_bool === false) return "No";
    return "";
  }
  if (meta.kind === "date") return (f.value_date ?? f.value_text ?? "").toString().slice(0, 10);
  if (meta.kind === "array") return (f.value_array ?? []).filter(Boolean).join(", ");
  if (f.value_text) return f.value_text;
  if (f.value_number !== null && f.value_number !== undefined) return String(f.value_number);
  return "";
}

function displayFromCurrent(meta: { kind: FieldKind }, cur: unknown): string | null {
  if (cur === null || cur === undefined || cur === "") return null;
  if (meta.kind === "bool") return cur === true ? "Yes" : cur === false ? "No" : null;
  if (meta.kind === "array") {
    const arr = Array.isArray(cur) ? cur : [];
    return arr.length ? arr.filter(Boolean).join(", ") : null;
  }
  if (meta.kind === "date") return String(cur).slice(0, 10);
  return String(cur);
}

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

/** name|dosage, the same duplicate key applyExtractedFieldsToClient uses. */
export function medicationKey(name: unknown, dosage: unknown): string {
  return `${str(name).toLowerCase()}|${str(dosage).toLowerCase()}`;
}

function medicationRow(f: ReviewField): Record<string, unknown> {
  return f.value_json && typeof f.value_json === "object"
    ? (f.value_json as Record<string, unknown>)
    : {};
}

/** One-line summary of an extracted medication for the review list. */
export function medicationSummary(f: ReviewField): { name: string; line: string } | null {
  const row = medicationRow(f);
  const name = str(row.medication_name ?? row.name ?? f.value_text);
  if (!name) return null;
  const times = Array.isArray(row.scheduled_times)
    ? row.scheduled_times.map(str).filter(Boolean).join(", ")
    : str(row.scheduled_time);
  const line = [
    name,
    str(row.dosage ?? row.dose),
    str(row.route),
    str(row.frequency ?? row.schedule),
    times,
    row.is_prn === true || str(row.is_prn).toLowerCase() === "true" ? "as needed" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return { name, line };
}

export interface BuildProposalsInput {
  fields: readonly ReviewField[];
  /** Current value for a profile field (clients column or contact part). */
  currentOf: (meta: ProfileFieldMeta) => unknown;
  /** name|dosage keys of medications already on file (any status). */
  existingMedicationKeys: ReadonlySet<string>;
  /** False when the person can't see medical info: medical rows are left out. */
  includeMedical: boolean;
}

/**
 * The review list: profile fields (one row per key) and one row per
 * medication. Changed rows first, then by label. Low-confidence and blank
 * values are dropped; nothing is ever made up.
 */
export function buildProposals(input: BuildProposalsInput): ReviewProposal[] {
  const out: ReviewProposal[] = [];
  const seen = new Set<string>();
  const seenMeds = new Set<string>();
  let medIndex = 0;
  for (const f of input.fields) {
    const confidence = f.confidence ?? 0.85;
    if (confidence < REVIEW_CONFIDENCE_THRESHOLD) continue;
    if (f.field_key === MEDICATION_FIELD_KEY) {
      if (!input.includeMedical) continue;
      const med = medicationSummary(f);
      if (!med) continue;
      const row = medicationRow(f);
      const key = medicationKey(med.name, row.dosage ?? row.dose);
      if (seenMeds.has(key)) continue;
      seenMeds.add(key);
      const onFile = input.existingMedicationKeys.has(key);
      out.push({
        field_key: `${MEDICATION_FIELD_KEY}:${medIndex++}`,
        label: `Medication: ${med.name}`,
        incomingValue: med.line,
        currentValue: onFile ? "Already on the medication list" : null,
        changed: !onFile,
        confidence,
        field: { ...f, confidence },
      });
      continue;
    }
    const meta = PROFILE_FIELD_MAP[f.field_key];
    if (!meta || seen.has(f.field_key)) continue;
    if (!input.includeMedical && isMedicalMeta(meta)) continue;
    seen.add(f.field_key);
    const incoming = displayFromField(meta, f).trim();
    if (!incoming) continue;
    const current = displayFromCurrent(meta, input.currentOf(meta));
    out.push({
      field_key: f.field_key,
      label: meta.label,
      incomingValue: incoming,
      currentValue: current,
      changed: (current ?? "") !== incoming,
      confidence,
      field: { ...f, confidence },
    });
  }
  return out.sort((a, b) =>
    a.changed === b.changed ? a.label.localeCompare(b.label) : a.changed ? -1 : 1,
  );
}

/** Rows ticked by default: the ones that would change something. */
export function defaultChecked(proposals: readonly ReviewProposal[]): Record<string, boolean> {
  return Object.fromEntries(proposals.map((p) => [p.field_key, p.changed && !!p.incomingValue]));
}
