// What staff read about a client's medications: the columns the care-data
// read selects, which meds staff see (active, not paused), the read-only
// card's lines, and the client-specific training's medication items.
// Pure; safe for browser and server.

import { nameWithStrength, sortMedications, whenGivenLabel } from "./med-display.ts";
import { howTakenLabel } from "./med-rules.ts";
import { ANY_MED_BAD_REACTION } from "./reference.ts";

/** client_medications columns staff surfaces read (getClientCareData). */
export const STAFF_MED_COLUMNS = [
  "id",
  "medication_name",
  "strength",
  "dose_form",
  "dosage",
  "route",
  "scheduled_times",
  "instructions",
  "how_taken",
  "purpose",
  "side_effects",
  "adverse_effects",
  "choking_risk",
  "contributes_to_swallowing_difficulty",
  "is_prn",
  "prn_instructions",
  "prn_try_first",
  "prn_min_hours",
  "prn_max_per_day",
  "prn_call_if",
  "is_rescue",
  "is_psychotropic",
  "psychotropic_type",
  "diagnosis",
  "used_for_behavior",
  "bsp_document_id",
  "is_controlled",
  "controlled_schedule",
  "is_active",
  "paused_at",
  "discontinued_at",
].join(", ");

/** One medication as staff see it (client_medications names). */
export interface StaffMedication {
  id: string;
  medication_name: string | null;
  strength: string | null;
  dose_form: string | null;
  dosage: string | null;
  route: string | null;
  scheduled_times: string[] | null;
  instructions: string | null;
  how_taken: string | null;
  purpose: string | null;
  side_effects: string | null;
  adverse_effects: string | null;
  choking_risk: boolean | null;
  contributes_to_swallowing_difficulty: boolean | null;
  is_prn: boolean | null;
  prn_instructions: string | null;
  prn_try_first: string | null;
  prn_min_hours: number | null;
  prn_max_per_day: number | null;
  prn_call_if: string | null;
  is_rescue: boolean | null;
  is_psychotropic: boolean | null;
  psychotropic_type: string | null;
  diagnosis: string | null;
  used_for_behavior: boolean | null;
  bsp_document_id: string | null;
  is_controlled: boolean | null;
  controlled_schedule: string | null;
  is_active: boolean | null;
  paused_at: string | null;
  discontinued_at: string | null;
}

/** Active, not paused, not stopped; sorted by first time of day, PRNs last. */
export function staffVisibleMeds<T extends Partial<StaffMedication>>(meds: readonly T[]): T[] {
  return sortMedications(
    meds.filter((m) => m.is_active !== false && !m.paused_at && !m.discontinued_at),
  );
}

function text(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export type ReadOnlyLine = { label: string; value: string };

export interface ReadOnlyMedView {
  id: string;
  title: string;
  /** "Tablet · by mouth" */
  subtitle: string | null;
  lines: ReadOnlyLine[];
  /** Signs of a bad reaction for this med (null when none on file). */
  badReaction: string | null;
  /** The line shown for every medication. */
  anyMedBadReaction: string;
  prn: ReadOnlyLine[] | null;
  psychotropic: ReadOnlyLine[] | null;
  /** Set when the med is used for behavior and a plan is linked. */
  bspDocumentId: string | null;
  usedForBehavior: boolean;
  countRequired: boolean;
  swallowingRisk: boolean;
  isPrn: boolean;
  isRescue: boolean;
}

function prnLines(m: Partial<StaffMedication>): ReadOnlyLine[] {
  const out: ReadOnlyLine[] = [];
  const when = text(m.prn_instructions);
  if (when) out.push({ label: "When to give", value: when });
  const first = text(m.prn_try_first);
  if (first) out.push({ label: "Try first", value: first });
  if (m.prn_min_hours != null)
    out.push({ label: "Wait at least", value: `${m.prn_min_hours} hours between doses` });
  if (m.prn_max_per_day != null)
    out.push({ label: "No more than", value: `${m.prn_max_per_day} a day` });
  const call = text(m.prn_call_if);
  if (call) out.push({ label: "Call if", value: call });
  return out;
}

function psychLines(m: Partial<StaffMedication>): ReadOnlyLine[] {
  const out: ReadOnlyLine[] = [];
  const type = text(m.psychotropic_type);
  out.push({ label: "Type", value: type ? capitalize(type) : "Not set" });
  const treats = text(m.diagnosis);
  if (treats) out.push({ label: "What it treats", value: treats });
  if (m.used_for_behavior) out.push({ label: "Used for behavior", value: "Yes" });
  return out;
}

/** Everything the read-only card shows for one medication. */
export function readOnlyMedView(m: Partial<StaffMedication> & { id: string }): ReadOnlyMedView {
  const lines: ReadOnlyLine[] = [{ label: "When given", value: whenGivenLabel(m) }];
  const purpose = text(m.purpose);
  if (purpose) lines.push({ label: "What it's for", value: purpose });
  if (m.how_taken) lines.push({ label: "How they take it", value: howTakenLabel(m.how_taken) });
  const instructions = text(m.instructions);
  if (instructions) lines.push({ label: "Directions", value: instructions });
  const watch = text(m.side_effects);
  if (watch) lines.push({ label: "Watch for", value: watch });
  const sub = [text(m.dose_form), text(m.route)].filter(Boolean).join(" · ");
  return {
    id: m.id,
    title: nameWithStrength(m) || "Unnamed medication",
    subtitle: sub || null,
    lines,
    badReaction: text(m.adverse_effects),
    anyMedBadReaction: ANY_MED_BAD_REACTION,
    prn: m.is_prn ? prnLines(m) : null,
    psychotropic: m.is_psychotropic ? psychLines(m) : null,
    bspDocumentId: m.is_psychotropic && m.used_for_behavior ? (m.bsp_document_id ?? null) : null,
    usedForBehavior: !!(m.is_psychotropic && m.used_for_behavior),
    countRequired: !!m.is_controlled,
    swallowingRisk: !!(m.choking_risk || m.contributes_to_swallowing_difficulty),
    isPrn: !!m.is_prn,
    isRescue: !!m.is_rescue,
  };
}

/** Columns the client-specific training's medication section reads. */
export const TRAINING_MED_COLUMNS =
  "medication_name, strength, dosage, route, scheduled_times, purpose, side_effects, adverse_effects, choking_risk, contributes_to_swallowing_difficulty, is_prn, prn_instructions, prn_min_hours, prn_max_per_day, is_psychotropic, psychotropic_type, used_for_behavior, is_active, paused_at, discontinued_at";

export type TrainingMedItem = {
  kind: "kv";
  label: string;
  pairs: Array<{ label: string; value: string }>;
};

/** One kv item per medication staff see: exact recorded facts only. */
export function trainingMedItems(meds: readonly Partial<StaffMedication>[]): TrainingMedItem[] {
  return staffVisibleMeds(meds).map((m) => {
    const pairs = [
      { label: "Dose", value: text(m.dosage) ?? text(m.strength) ?? "—" },
      { label: "Route", value: text(m.route) ?? "—" },
      { label: "When given", value: whenGivenLabel(m) },
      { label: "What it's for", value: text(m.purpose) ?? "—" },
      { label: "Side effects", value: text(m.side_effects) ?? "—" },
      { label: "Signs of a bad reaction", value: text(m.adverse_effects) ?? "—" },
      { label: "PRN", value: m.is_prn ? "Yes" : "No" },
    ];
    if (m.is_prn) {
      const rules = prnLines(m).map((l) => `${l.label}: ${l.value}`);
      pairs.push({ label: "PRN rules", value: rules.length ? rules.join("; ") : "—" });
    }
    if (m.is_psychotropic) {
      const type = text(m.psychotropic_type);
      pairs.push({
        label: "Psychotropic",
        value: `Yes${type ? ` (${type})` : ""}${m.used_for_behavior ? ", used for behavior" : ""}`,
      });
    }
    pairs.push({
      label: "Choking risk flagged",
      value: m.choking_risk || m.contributes_to_swallowing_difficulty ? "Yes" : "No",
    });
    return { kind: "kv" as const, label: nameWithStrength(m) || "Unnamed medication", pairs };
  });
}
