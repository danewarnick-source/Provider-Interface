// ─── Client field registry (the list) ─────────────────────────────────────
// Every tracked client field, declared once. Accessors and the writer live in
// ./profile-fields.ts. See that file's header for how storage works.

import {
  LEGACY_ALERT_KEY,
  LEGACY_SINGLE_SOURCE_KEYS,
  legacyContactKey,
  type ContactPart,
} from "./legacy-fields.ts";
import type { ContactRole } from "./contacts.ts";

export type ProfileFieldStorage =
  | { kind: "column"; column: string }
  | { kind: "custom" }
  | { kind: "contact"; role: ContactRole; part: ContactPart };

export type ProfileFieldType = "text" | "textarea" | "bool" | "array" | "date";

export interface ProfileField {
  key: string;                 // canonical key — MUST equal the extraction field_key
  label: string;
  type: ProfileFieldType;
  storage: ProfileFieldStorage;
  sowRequired?: boolean;
  extractionKeys?: string[];   // additional extracted keys mapping to this field
  helpText?: string;
}

/** A registry field stored on the role's main contact. */
function contactField(
  role: ContactRole,
  part: ContactPart,
  label: string,
  extra: Pick<ProfileField, "sowRequired" | "extractionKeys"> = {},
): ProfileField {
  return { key: legacyContactKey(role, part), label, type: "text", storage: { kind: "contact", role, part }, ...extra };
}

export const CLIENT_PROFILE_FIELDS: ProfileField[] = [
  // ── Column-backed identity & contact ──────────────────────────────────
  { key: "first_name", label: "First name", type: "text",
    storage: { kind: "column", column: "first_name" } },
  { key: "last_name", label: "Last name", type: "text",
    storage: { kind: "column", column: "last_name" } },
  { key: "date_of_birth", label: "Date of birth", type: "date",
    storage: { kind: "column", column: "date_of_birth" }, extractionKeys: ["dob"] },
  { key: "medicaid_id", label: "Medicaid ID", type: "text",
    storage: { kind: "column", column: "medicaid_id" } },
  { key: "phone_number", label: "Phone", type: "text",
    storage: { kind: "column", column: "phone_number" }, extractionKeys: ["phone"] },
  { key: "physical_address", label: "Physical address", type: "text",
    storage: { kind: "column", column: "physical_address" } },

  // ── SOW-required fields ───────────────────────────────────────────────
  contactField("emergency", "name", "Emergency contact name", { sowRequired: true }),
  contactField("emergency", "phone", "Emergency contact phone", { sowRequired: true }),
  { key: "allergies", label: "Allergies", type: "array",
    storage: { kind: "column", column: "allergies" }, sowRequired: true },
  { key: "special_directions", label: "Must-knows for staff", type: "textarea",
    storage: { kind: "column", column: "special_directions" }, sowRequired: true,
    extractionKeys: [LEGACY_ALERT_KEY] },

  // ── Contacts: support coordinator ─────────────────────────────────────
  contactField("support_coordinator", "name", "Support coordinator name", {
    sowRequired: true, extractionKeys: ["sc_name", "coordinator_name", "support_coordinator"] }),
  contactField("support_coordinator", "phone", "Support coordinator phone", {
    sowRequired: true, extractionKeys: ["sc_phone", "coordinator_phone"] }),
  contactField("support_coordinator", "email", "Support coordinator email", {
    sowRequired: true, extractionKeys: ["sc_email", "coordinator_email"] }),

  // ── Contacts: medical providers ───────────────────────────────────────
  contactField("primary_doctor", "name", "Primary care provider name", { sowRequired: true }),
  contactField("primary_doctor", "phone", "Primary care provider phone", { sowRequired: true }),
  contactField("neurologist", "name", "Neurologist name"),
  contactField("neurologist", "phone", "Neurologist phone"),
  contactField("dentist", "name", "Dentist name"),
  contactField("dentist", "phone", "Dentist phone"),
  contactField("prescriber", "name", "Prescribing physician name"),
  contactField("prescriber", "phone", "Prescribing physician phone"),
  { key: "insurance", label: "Insurance", type: "textarea",
    storage: { kind: "column", column: "insurance" }, extractionKeys: [LEGACY_SINGLE_SOURCE_KEYS.insurance] },

  // ── Custom-backed: directives, clinical, legal ────────────────────────
  { key: "advanced_directives", label: "Advanced directives", type: "textarea",
    storage: { kind: "custom" }, sowRequired: true },
  { key: "emergency_medical_treatment_authorization",
    label: "Emergency medical treatment authorization", type: "bool",
    storage: { kind: "custom" }, sowRequired: true },
  { key: "diagnoses", label: "Diagnoses", type: "array",
    storage: { kind: "custom" } },
  { key: "chronic_conditions", label: "Chronic conditions", type: "array",
    storage: { kind: "custom" } },
  { key: "immunizations", label: "Immunizations", type: "text",
    storage: { kind: "custom" } },
  { key: "court_orders", label: "Court orders", type: "textarea",
    storage: { kind: "custom" } },
  { key: "housing_voucher", label: "Housing voucher", type: "text",
    storage: { kind: "custom" } },

  // ── Expanded PCSP-first profile capture (custom-backed) ───────────────
  // Every field the standard Utah DSPD PCSP surfaces but the clients table
  // doesn't have a dedicated column for. Registered here so extraction lands
  // it AND the profile UI (registry-driven) renders it as a first-class row.
  { key: "preferred_name", label: "Preferred name / nickname", type: "text",
    storage: { kind: "custom" } },
  { key: "pronouns", label: "Pronouns", type: "text",
    storage: { kind: "custom" } },
  { key: "gender", label: "Gender", type: "text",
    storage: { kind: "custom" } },
  { key: "primary_language", label: "Primary language", type: "text",
    storage: { kind: "custom" } },
  { key: "communication_notes", label: "Communication notes", type: "textarea",
    storage: { kind: "custom" } },
  { key: "race", label: "Race", type: "text",
    storage: { kind: "custom" } },
  { key: "ethnicity", label: "Ethnicity", type: "text",
    storage: { kind: "custom" } },
  { key: "marital_status", label: "Marital status", type: "text",
    storage: { kind: "custom" } },
  { key: "secondary_phone", label: "Secondary phone", type: "text",
    storage: { kind: "custom" } },
  { key: "email", label: "Email", type: "text",
    storage: { kind: "custom" } },
  { key: "county", label: "County", type: "text",
    storage: { kind: "custom" } },
  { key: "mobility_notes", label: "Mobility notes", type: "textarea",
    storage: { kind: "custom" } },
  { key: "adaptive_equipment", label: "Adaptive equipment", type: "textarea",
    storage: { kind: "custom" } },
  { key: "dietary_restrictions", label: "Dietary restrictions", type: "textarea",
    storage: { kind: "custom" } },
  { key: "vision_status", label: "Vision", type: "text",
    storage: { kind: "custom" } },
  { key: "hearing_status", label: "Hearing", type: "text",
    storage: { kind: "custom" } },
  { key: "weight", label: "Weight", type: "text",
    storage: { kind: "custom" } },
  { key: "height", label: "Height", type: "text",
    storage: { kind: "custom" } },
  { key: "blood_type", label: "Blood type", type: "text",
    storage: { kind: "custom" } },
  { key: "day_program_name", label: "Day program name", type: "text",
    storage: { kind: "custom" } },
  { key: "day_program_phone", label: "Day program phone", type: "text",
    storage: { kind: "custom" } },
  { key: "transportation_notes", label: "Transportation notes", type: "textarea",
    storage: { kind: "custom" } },
  { key: "funding_source", label: "Funding source", type: "text",
    storage: { kind: "custom" } },
  { key: "secondary_insurance", label: "Secondary insurance", type: "text",
    storage: { kind: "custom" } },
  { key: "medicare_id", label: "Medicare ID", type: "text",
    storage: { kind: "custom" } },
  { key: "representative_payee", label: "Representative payee", type: "text",
    storage: { kind: "custom" } },
  // PCSP plan metadata
  { key: "pcsp_author_name", label: "PCSP author / facilitator", type: "text",
    storage: { kind: "custom" } },
  { key: "pcsp_meeting_date", label: "PCSP meeting date", type: "date",
    storage: { kind: "custom" } },
  { key: "pcsp_effective_start", label: "PCSP effective start", type: "date",
    storage: { kind: "custom" } },
  { key: "pcsp_review_date", label: "PCSP review date", type: "date",
    storage: { kind: "custom" } },
  { key: "pcsp_signed_by_client", label: "PCSP signed by client", type: "bool",
    storage: { kind: "custom" } },
  { key: "pcsp_signed_by_guardian", label: "PCSP signed by guardian", type: "bool",
    storage: { kind: "custom" } },
];

export type CustomValueRow = {
  value_text: string | null;
  value_boolean: boolean | null;
};

export type ProfileCustomsMap = Record<string, CustomValueRow | null>;

export const PROFILE_FIELD_BY_KEY: Record<string, ProfileField> = Object.fromEntries(
  CLIENT_PROFILE_FIELDS.map((f) => [f.key, f]),
);

/** All clients columns the registry needs to read for column-backed fields. */
export const PROFILE_CLIENT_COLUMNS: string[] = Array.from(
  new Set(
    CLIENT_PROFILE_FIELDS
      .filter((f) => f.storage.kind === "column")
      .map((f) => (f.storage as { column: string }).column),
  ),
);

/** Custom-only keys — used to query custom_field_definitions efficiently. */
export const PROFILE_CUSTOM_KEYS: string[] = CLIENT_PROFILE_FIELDS
  .filter((f) => f.storage.kind === "custom")
  .map((f) => f.key);
