// The medication form's values: from a saved row, to saveMedication's
// input, the built-in list's suggestions, and inline errors. Suggestions
// never touch dose or times. Pure; safe for browser and server.

import { requiredFieldErrors, type HowTaken, type MedicationFields } from "./med-rules.ts";
import type { MedicationReference } from "./reference.ts";

export interface MedFormValues {
  medication_name: string;
  reference_key: string | null;
  strength: string;
  dose_form: string;
  dosage: string;
  route: string;
  is_prn: boolean;
  scheduled_times: string[];
  instructions: string;
  start_date: string;
  end_date: string;
  prescriber: string;
  pharmacy: string;
  rx_number: string;
  packaging: string;
  packaging_approval_path: string | null;
  label_photo_path: string | null;
  purpose: string;
  side_effects: string;
  adverse_effects: string;
  choking_risk: boolean | null;
  how_taken: HowTaken | null;
  prn_instructions: string;
  prn_try_first: string;
  prn_min_hours: string;
  prn_max_per_day: string;
  prn_followup_minutes: string;
  prn_call_if: string;
  is_rescue: boolean;
  is_psychotropic: boolean;
  psychotropic_type: string;
  diagnosis: string;
  used_for_behavior: boolean;
  bsp_document_id: string | null;
  hrc_restriction_id: string | null;
  consent_date: string;
  consent_document_path: string | null;
  next_review_date: string;
  is_controlled: boolean;
  controlled_schedule: string;
  pill_count_current: string;
}

export type MedFormKey = keyof MedFormValues;

export function emptyMedForm(today = ""): MedFormValues {
  return {
    medication_name: "",
    reference_key: null,
    strength: "",
    dose_form: "",
    dosage: "",
    route: "",
    is_prn: false,
    scheduled_times: [],
    instructions: "",
    start_date: today,
    end_date: "",
    prescriber: "",
    pharmacy: "",
    rx_number: "",
    packaging: "",
    packaging_approval_path: null,
    label_photo_path: null,
    purpose: "",
    side_effects: "",
    adverse_effects: "",
    choking_risk: null,
    how_taken: null,
    prn_instructions: "",
    prn_try_first: "",
    prn_min_hours: "",
    prn_max_per_day: "",
    prn_followup_minutes: "60",
    prn_call_if: "",
    is_rescue: false,
    is_psychotropic: false,
    psychotropic_type: "",
    diagnosis: "",
    used_for_behavior: false,
    bsp_document_id: null,
    hrc_restriction_id: null,
    consent_date: "",
    consent_document_path: null,
    next_review_date: "",
    is_controlled: false,
    controlled_schedule: "",
    pill_count_current: "",
  };
}

const str = (v: unknown) => (v == null ? "" : String(v));
const day = (v: unknown) => str(v).slice(0, 10);
const HOW: readonly string[] = ["self", "assist", "nurse"];

/** A saved client_medications row → form values. */
export function medFormFromRow(row: Record<string, unknown>): MedFormValues {
  const base = emptyMedForm();
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base) as MedFormKey[]) {
    const v = row[key];
    const empty = base[key];
    if (typeof empty === "boolean") out[key] = v === true;
    else if (Array.isArray(empty)) out[key] = Array.isArray(v) ? v.map(String) : [];
    else if (empty === null) out[key] = v == null || v === "" ? null : String(v);
    else out[key] = key.endsWith("_date") ? day(v) : str(v);
  }
  out.choking_risk = typeof row.choking_risk === "boolean" ? row.choking_risk : null;
  out.how_taken = HOW.includes(String(row.how_taken)) ? (row.how_taken as HowTaken) : null;
  if (row.prn_followup_minutes == null) out.prn_followup_minutes = row.is_prn ? "" : "60";
  return out as unknown as MedFormValues;
}

const text = (v: string) => (v.trim() === "" ? null : v.trim());
function num(v: string, int = false): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return int ? Math.trunc(n) : n;
}

/** Form values → saveMedication's `medication`. Unticked parts are cleared. */
export function medInputFromForm(v: MedFormValues): Record<string, unknown> & MedicationFields {
  const prn = v.is_prn;
  const psych = v.is_psychotropic;
  const behavior = psych && v.used_for_behavior;
  const ctrl = v.is_controlled;
  return {
    medication_name: text(v.medication_name),
    reference_key: v.reference_key,
    strength: text(v.strength),
    dose_form: text(v.dose_form),
    dosage: text(v.dosage),
    route: text(v.route),
    is_prn: prn,
    scheduled_times: prn ? [] : v.scheduled_times.filter((t) => t.trim() !== ""),
    instructions: text(v.instructions),
    start_date: text(v.start_date),
    end_date: text(v.end_date),
    prescriber: text(v.prescriber),
    pharmacy: text(v.pharmacy),
    rx_number: text(v.rx_number),
    packaging: text(v.packaging),
    packaging_approval_path: v.packaging_approval_path,
    label_photo_path: v.label_photo_path,
    purpose: text(v.purpose),
    side_effects: text(v.side_effects),
    adverse_effects: text(v.adverse_effects),
    choking_risk: v.choking_risk,
    how_taken: v.how_taken,
    prn_instructions: prn ? text(v.prn_instructions) : null,
    prn_try_first: prn ? text(v.prn_try_first) : null,
    prn_min_hours: prn ? num(v.prn_min_hours) : null,
    prn_max_per_day: prn ? num(v.prn_max_per_day, true) : null,
    prn_followup_minutes: prn ? num(v.prn_followup_minutes, true) : null,
    prn_call_if: prn ? text(v.prn_call_if) : null,
    is_rescue: prn && v.is_rescue,
    is_psychotropic: psych,
    psychotropic_type: psych ? text(v.psychotropic_type) : null,
    diagnosis: psych ? text(v.diagnosis) : null,
    used_for_behavior: behavior,
    bsp_document_id: behavior ? v.bsp_document_id : null,
    hrc_restriction_id: behavior ? v.hrc_restriction_id : null,
    consent_date: psych ? text(v.consent_date) : null,
    consent_document_path: psych ? v.consent_document_path : null,
    next_review_date: psych ? text(v.next_review_date) : null,
    is_controlled: ctrl,
    controlled_schedule: ctrl ? text(v.controlled_schedule) : null,
    pill_count_current: ctrl ? num(v.pill_count_current, true) : null,
  } as Record<string, unknown> & MedicationFields;
}

/** Required-field errors keyed by form field (first message per field). */
export function medFormErrors(v: MedFormValues): Partial<Record<MedFormKey, string>> {
  const out: Partial<Record<MedFormKey, string>> = {};
  for (const issue of requiredFieldErrors(medInputFromForm(v))) {
    const key = issue.field as MedFormKey;
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** One pick from a reference "form" line: "tablet 325, 500 mg" → tablet 325 mg, tablet 500 mg. */
export interface StrengthOption {
  doseForm: string;
  strength: string;
  label: string;
}

export function strengthOptions(forms: readonly string[]): StrengthOption[] {
  const out: StrengthOption[] = [];
  for (const raw of forms) {
    const m = /^(.*?)\s*(\d.*)?$/.exec(raw.trim());
    const doseForm = (m?.[1] ?? raw).trim();
    const amounts = m?.[2]?.trim();
    if (!amounts) {
      out.push({ doseForm, strength: "", label: doseForm });
      continue;
    }
    const items = amounts.split(/,\s*/);
    const unit = /^[\d./]+\s*(.*)$/.exec(items[items.length - 1])?.[1] ?? "";
    for (const item of items) {
      const bare = /^[\d./]+$/.test(item);
      const strength = bare && unit ? `${item}${unit.startsWith("%") ? "" : " "}${unit}` : item;
      out.push({ doseForm, strength, label: `${doseForm} ${strength}`.trim() });
    }
  }
  return out;
}

/** Fields the built-in list may fill (never dose or times). */
export const SUGGESTED_FIELDS = [
  "side_effects",
  "adverse_effects",
  "choking_risk",
  "is_psychotropic",
  "psychotropic_type",
  "is_controlled",
  "controlled_schedule",
] as const satisfies readonly MedFormKey[];
export type SuggestedField = (typeof SUGGESTED_FIELDS)[number];

function isUnset(v: MedFormValues, key: SuggestedField): boolean {
  const cur = v[key];
  return cur === null || cur === false || cur === "";
}

/**
 * Picking a built-in entry: sets the name and reference_key, and fills each
 * suggestible field that is still empty or holds an earlier suggestion.
 * Returns the new values and which fields now hold a suggestion.
 */
export function applyReference(
  v: MedFormValues,
  ref: MedicationReference,
  previouslySuggested: ReadonlySet<SuggestedField> = new Set(),
): { values: MedFormValues; suggested: Set<SuggestedField> } {
  const proposal: Pick<MedFormValues, SuggestedField> = {
    side_effects: ref.sideEffects,
    adverse_effects: ref.badReaction,
    choking_risk: ref.swallowRisk,
    is_psychotropic: ref.psychotropic != null,
    psychotropic_type: ref.psychotropic ?? "",
    is_controlled: ref.controlled != null,
    controlled_schedule: ref.controlled ?? "",
  };
  const next = { ...v, medication_name: ref.name, reference_key: ref.key };
  const suggested = new Set<SuggestedField>();
  for (const key of SUGGESTED_FIELDS) {
    if (!isUnset(v, key) && !previouslySuggested.has(key)) continue;
    (next as Record<string, unknown>)[key] = proposal[key];
    suggested.add(key);
  }
  return { values: next, suggested };
}
