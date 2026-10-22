// PI's built-in medication list (medication-reference.json). Suggestions
// only: the admin checks every field against the pharmacy label. Dose and
// times are never taken from here. Pure; safe for browser and server.

import data from "./medication-reference.json" with { type: "json" };

export type PsychotropicType =
  | "antipsychotic"
  | "antidepressant"
  | "mood stabilizer"
  | "anti-anxiety"
  | "stimulant"
  | "sleep"
  | "other";

export type ControlledSchedule = "II" | "III" | "IV" | "V";

export interface MedicationReference {
  /** Stable id stored on client_medications.reference_key. */
  key: string;
  name: string;
  brands: string[];
  drugClass: string;
  /** The med's own psychotropic class, or a secondary psychotropic use. */
  psychotropic: PsychotropicType | null;
  controlled: ControlledSchedule | null;
  forms: string[];
  uses: string[];
  sideEffects: string;
  badReaction: string;
  swallowRisk: boolean;
}

interface RawMed {
  name: string;
  brands: string[];
  drug_class: string;
  psychotropic: string | null;
  also_psychotropic?: string | null;
  controlled: string | null;
  forms: string[];
  uses: string[];
  side_effects: string;
  bad_reaction: string;
  swallow_risk: boolean;
}

/** The line shown under "signs of a bad reaction" for every medication. */
export const ANY_MED_BAD_REACTION: string = data.any_med_bad_reaction;

/** Shown under every suggested field. */
export const SUGGESTION_NOTE =
  "Suggested from PI's medication list. Check it against the pharmacy label.";

export function referenceKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toReference(m: RawMed): MedicationReference {
  return {
    key: referenceKey(m.name),
    name: m.name,
    brands: m.brands,
    drugClass: m.drug_class,
    psychotropic: (m.psychotropic ?? m.also_psychotropic ?? null) as PsychotropicType | null,
    controlled: (m.controlled ?? null) as ControlledSchedule | null,
    forms: m.forms,
    uses: m.uses,
    sideEffects: m.side_effects,
    badReaction: m.bad_reaction,
    swallowRisk: m.swallow_risk,
  };
}

export const MEDICATION_REFERENCE: readonly MedicationReference[] = (data.meds as RawMed[]).map(
  toReference,
);

const BY_KEY = new Map(MEDICATION_REFERENCE.map((m) => [m.key, m]));

export function getReference(key: string | null | undefined): MedicationReference | null {
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

/**
 * Type-ahead search. Ranks, in order: generic name starts with the query,
 * a brand starts with it, generic name contains it, a brand contains it.
 * Case-insensitive. Within a rank, alphabetical by generic name.
 */
export function searchMedications(
  query: string,
  limit = 8,
  list: readonly MedicationReference[] = MEDICATION_REFERENCE,
): MedicationReference[] {
  const q = query.trim().toLowerCase();
  if (!q || limit <= 0) return [];
  const ranked: Array<{ med: MedicationReference; rank: number }> = [];
  for (const med of list) {
    const name = med.name.toLowerCase();
    const brands = med.brands.map((b) => b.toLowerCase());
    let rank = -1;
    if (name.startsWith(q)) rank = 0;
    else if (brands.some((b) => b.startsWith(q))) rank = 1;
    else if (name.includes(q)) rank = 2;
    else if (brands.some((b) => b.includes(q))) rank = 3;
    if (rank >= 0) ranked.push({ med, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.med.name.localeCompare(b.med.name));
  return ranked.slice(0, limit).map((r) => r.med);
}
