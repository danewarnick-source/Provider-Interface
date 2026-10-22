// Pure medication rules shared by the form, the server functions and the
// MAR. Contract-required fields (DHHS91172 §1.23) are errors (can't save);
// psychotropic compliance gaps are warnings (remind, don't block).

import { denverWallToIso, denverYmdFromInstant } from "../denver-date.ts";

export type HowTaken = "self" | "assist" | "nurse";
export const HOW_TAKEN_VALUES: readonly HowTaken[] = ["self", "assist", "nurse"];

/** Legacy client_medications.support_level values (kept in sync until M6). */
export type SupportLevel =
  | "self"
  | "staff_observed"
  | "staff_administered"
  | "lpn"
  | "rn"
  | "delegated";

/** The medication fields the rules read (client_medications column names). */
export interface MedicationFields {
  medication_name?: string | null;
  strength?: string | null;
  dosage?: string | null;
  route?: string | null;
  scheduled_times?: string[] | null;
  is_prn?: boolean | null;
  purpose?: string | null;
  side_effects?: string | null;
  adverse_effects?: string | null;
  /** Swallowing or choking risk, answered yes/no. Null means not answered. */
  choking_risk?: boolean | null;
  how_taken?: HowTaken | null;
  packaging?: string | null;
  packaging_approval_path?: string | null;
  prescriber?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  prn_instructions?: string | null;
  prn_min_hours?: number | null;
  prn_max_per_day?: number | null;
  prn_followup_minutes?: number | null;
  is_controlled?: boolean | null;
  controlled_schedule?: string | null;
  pill_count_current?: number | null;
  is_psychotropic?: boolean | null;
  diagnosis?: string | null;
  consent_date?: string | null;
  next_review_date?: string | null;
  used_for_behavior?: boolean | null;
  bsp_document_id?: string | null;
  hrc_restriction_id?: string | null;
  is_active?: boolean | null;
  discontinued_at?: string | null;
  paused_at?: string | null;
}

export interface FieldIssue {
  field: keyof MedicationFields;
  message: string;
}

/** Packaging value that needs written DSPD approval on file. */
export const ORIGINAL_BOTTLE = "original";

const blank = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

/** Contract-required fields. Any issue here blocks saving. */
export function requiredFieldErrors(med: MedicationFields): FieldIssue[] {
  const out: FieldIssue[] = [];
  const need = (field: keyof MedicationFields, message: string) => {
    if (blank(med[field])) out.push({ field, message });
  };
  need("medication_name", "Add the medication name.");
  if (blank(med.strength) && blank(med.dosage))
    out.push({ field: "dosage", message: "Add the strength or dose." });
  need("route", "Add how it's given (route).");
  if (!med.is_prn && (med.scheduled_times ?? []).filter((t) => !blank(t)).length === 0) {
    out.push({
      field: "scheduled_times",
      message: "Add the times it's given, or mark it as needed.",
    });
  }
  need("purpose", "Add what it's for.");
  need("side_effects", "Add common side effects.");
  need("adverse_effects", "Add signs of a bad reaction.");
  if (med.choking_risk == null)
    out.push({
      field: "choking_risk",
      message: "Answer whether there's a swallowing or choking risk.",
    });
  if (!med.how_taken || !HOW_TAKEN_VALUES.includes(med.how_taken)) {
    out.push({ field: "how_taken", message: "Choose how they take it." });
  }
  need("packaging", "Add the packaging.");
  if (med.packaging === ORIGINAL_BOTTLE && blank(med.packaging_approval_path)) {
    out.push({
      field: "packaging_approval_path",
      message: "Upload the written approval for the original bottle.",
    });
  }
  need("prescriber", "Add the prescriber.");
  need("start_date", "Add the start date.");
  if (
    !blank(med.start_date) &&
    !blank(med.end_date) &&
    String(med.end_date) < String(med.start_date)
  ) {
    out.push({ field: "end_date", message: "The stop date is before the start date." });
  }
  if (med.is_prn) {
    need("prn_instructions", "Add when to give it.");
    if (!(Number(med.prn_min_hours) > 0))
      out.push({ field: "prn_min_hours", message: "Add the minimum hours between doses." });
    if (!(Number(med.prn_max_per_day) >= 1))
      out.push({ field: "prn_max_per_day", message: "Add the most doses in 24 hours." });
    if (!(Number(med.prn_followup_minutes) > 0)) {
      out.push({
        field: "prn_followup_minutes",
        message: "Add when to check whether it worked (minutes).",
      });
    }
  }
  if (med.is_controlled) {
    if (!["II", "III", "IV", "V"].includes(String(med.controlled_schedule ?? ""))) {
      out.push({
        field: "controlled_schedule",
        message: "Choose the controlled schedule (II to V).",
      });
    }
    if (med.pill_count_current == null || !(Number(med.pill_count_current) >= 0)) {
      out.push({ field: "pill_count_current", message: "Add the count on hand now." });
    }
  }
  return out;
}

/** Psychotropic reminders. Never block saving. */
export function psychotropicWarnings(med: MedicationFields): FieldIssue[] {
  if (!med.is_psychotropic) return [];
  const out: FieldIssue[] = [];
  if (blank(med.diagnosis)) out.push({ field: "diagnosis", message: "Missing: what it treats" });
  if (blank(med.consent_date)) out.push({ field: "consent_date", message: "Missing: consent" });
  if (blank(med.next_review_date))
    out.push({ field: "next_review_date", message: "Missing: next prescriber review" });
  if (med.used_for_behavior) {
    if (blank(med.bsp_document_id))
      out.push({ field: "bsp_document_id", message: "Missing: behavior support plan" });
    if (blank(med.hrc_restriction_id)) {
      out.push({
        field: "hrc_restriction_id",
        message: "Missing: Human Rights Committee approval",
      });
    }
  }
  return out;
}

export function howTakenLabel(how: HowTaken | string | null | undefined): string {
  switch (how) {
    case "self":
      return "Takes it on their own with staff watching";
    case "assist":
      return "Staff help (prompt, open, hand it over)";
    case "nurse":
      return "Nurse gives it";
    default:
      return "Not set";
  }
}

export function howTakenFromSupportLevel(level: string | null | undefined): HowTaken | null {
  switch (level) {
    case "self":
    case "staff_observed":
      return "self";
    case "staff_administered":
      return "assist";
    case "lpn":
    case "rn":
    case "delegated":
      return "nurse";
    default:
      return null;
  }
}

/** support_level to write for main until M6; keeps the current one when it already matches. */
export function supportLevelForHowTaken(
  how: HowTaken | null | undefined,
  current?: string | null,
): SupportLevel | null {
  if (!how) return null;
  if (current && howTakenFromSupportLevel(current) === how) return current as SupportLevel;
  return how === "self" ? "staff_observed" : how === "assist" ? "staff_administered" : "rn";
}

export interface PrnCheckInput {
  /** When earlier doses of this PRN were taken (any order). */
  lastDoses: Array<Date | string>;
  minHours?: number | null;
  maxPerDay?: number | null;
  now?: Date;
}

export interface PrnCheckResult {
  tooSoon: boolean;
  overMax: boolean;
  /** Earliest time another dose is within both limits; null when it is allowed now. */
  nextAllowedAt: Date | null;
}

const HOUR = 3_600_000;

export function prnCheck({
  lastDoses,
  minHours,
  maxPerDay,
  now = new Date(),
}: PrnCheckInput): PrnCheckResult {
  const t = now.getTime();
  const times = lastDoses
    .map((d) => (d instanceof Date ? d.getTime() : Date.parse(d)))
    .filter((ms) => Number.isFinite(ms) && ms <= t)
    .sort((a, b) => a - b);
  let next = t;
  let tooSoon = false;
  if (minHours != null && minHours > 0 && times.length > 0) {
    const allowed = times[times.length - 1] + minHours * HOUR;
    if (allowed > t) {
      tooSoon = true;
      next = Math.max(next, allowed);
    }
  }
  let overMax = false;
  if (maxPerDay != null && maxPerDay > 0) {
    const inWindow = times.filter((ms) => ms > t - 24 * HOUR);
    if (inWindow.length >= maxPerDay) {
      overMax = true;
      // A slot frees up when the dose that puts the count at the max leaves the 24-hour window.
      next = Math.max(next, inWindow[inWindow.length - maxPerDay] + 24 * HOUR);
    }
  }
  return { tooSoon, overMax, nextAllowedAt: tooSoon || overMax ? new Date(next) : null };
}

export interface ExpectedDose {
  /** "HH:MM" from scheduled_times. */
  time: string;
  /** scheduled_for as UTC ISO (the Denver wall-clock time on that day). */
  scheduledFor: string;
  /** Paused on this day: due, but held. */
  held: boolean;
}

function parseHm(raw: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? { h, m } : null;
}

/** Scheduled doses due on a Denver calendar day (YYYY-MM-DD). PRNs have none. */
export function expectedDoses(med: MedicationFields, day: string): ExpectedDose[] {
  if (med.is_prn) return [];
  if (med.start_date && day < med.start_date.slice(0, 10)) return [];
  if (med.end_date && day > med.end_date.slice(0, 10)) return [];
  const stoppedOn = denverYmdFromInstant(med.discontinued_at ?? null);
  if (stoppedOn && day >= stoppedOn) return [];
  if (med.is_active === false && !stoppedOn) return [];
  const pausedOn = denverYmdFromInstant(med.paused_at ?? null);
  const held = !!pausedOn && day >= pausedOn;
  const seen = new Set<string>();
  const out: ExpectedDose[] = [];
  for (const raw of med.scheduled_times ?? []) {
    const hm = parseHm(raw);
    if (!hm) continue;
    const time = `${String(hm.h).padStart(2, "0")}:${String(hm.m).padStart(2, "0")}`;
    if (seen.has(time)) continue;
    seen.add(time);
    out.push({ time, scheduledFor: denverWallToIso(day, hm.h, hm.m), held });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
