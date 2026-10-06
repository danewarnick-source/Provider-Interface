// Pure rules for the client Health section: advance directive status,
// medication support level, health event and absence labels, and which
// clients show absences. No Supabase, importable by node --test.

import { parseLocalDate } from "./dates.ts";

export type DirectiveStatus = "none" | "dnr" | "polst";

export const DIRECTIVE_OPTIONS: { value: DirectiveStatus; label: string }[] = [
  { value: "none", label: "None" },
  { value: "dnr", label: "DNR" },
  { value: "polst", label: "POLST" },
];

/**
 * The directive status stored in clients.dnr_status. Older rows may hold
 * free text; "dnr"/"polst" anywhere in it maps to that option, blank is
 * unknown (null) and anything else reads as None.
 */
export function directiveStatus(raw: string | null | undefined): DirectiveStatus | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v.includes("polst")) return "polst";
  if (/\bdnr\b|do not resuscitate/.test(v)) return "dnr";
  return "none";
}

export function directiveLabel(status: DirectiveStatus | null): string | null {
  return DIRECTIVE_OPTIONS.find((o) => o.value === status)?.label ?? null;
}

export type DirectiveDraft = {
  status: DirectiveStatus;
  location: string;
  palliative: string;
  hospice: string;
  notes: string;
};

const blank = (v: string) => (v.trim() ? v.trim() : null);

/**
 * clients columns for a saved advance directive card. dnr_applicable (which
 * makes a DNR/POLST document required in the client file) follows the status.
 */
export function directivePatch(d: DirectiveDraft): Record<string, string | boolean | null> {
  const label = directiveLabel(d.status);
  return {
    dnr_status: label,
    dnr_applicable: d.status !== "none",
    dnr_location: d.status === "none" ? null : blank(d.location),
    polst_status: d.status === "polst" ? "POLST" : null,
    palliative_care_status: blank(d.palliative),
    hospice_status: blank(d.hospice),
    advance_directive_notes: blank(d.notes),
  };
}

/** clients.self_admin_med_support → the plain-English support level. */
export function medicationSupportLabel(selfAdmin: boolean | null | undefined): string {
  if (selfAdmin === true) return "Takes their own medications with staff support";
  if (selfAdmin === false) return "Staff give medications (not cleared to self-administer)";
  return "Not set";
}

export const HEALTH_EVENT_TYPES = [
  { value: "exam", label: "Exam" },
  { value: "injury", label: "Injury" },
  { value: "surgery", label: "Surgery" },
  { value: "immunization", label: "Immunization" },
  { value: "health_change", label: "Health change" },
  { value: "hospital", label: "Hospital" },
] as const;
export type HealthEventType = (typeof HEALTH_EVENT_TYPES)[number]["value"];

export const ABSENCE_REASONS = [
  { value: "hospital", label: "Hospital" },
  { value: "vacation", label: "Vacation" },
  { value: "other", label: "Other" },
] as const;
export type AbsenceReason = (typeof ABSENCE_REASONS)[number]["value"];

export function labelFor(list: readonly { value: string; label: string }[], value: string): string {
  return list.find((o) => o.value === value)?.label ?? value;
}

/** Absences are tracked for staffed residential (RHS) clients only. */
export function showsAbsences(codes: readonly string[]): boolean {
  return codes.some((c) => c.trim().toUpperCase() === "RHS");
}

/** Days away, counting both ends; null while the absence is still open or dates are bad. */
export function absenceDays(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  if (!a || !b || b < a) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

/** Validates a new absence before it is saved; returns the problem or null. */
export function absenceProblem(from: string, to: string | null): string | null {
  if (!parseLocalDate(from)) return "Pick the first day away.";
  if (to && !parseLocalDate(to)) return "The return date isn't a date.";
  if (to && to < from) return "The return date can't be before the first day away.";
  return null;
}

/** Splits a comma / newline separated list into trimmed, distinct items. */
export function splitList(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const v = raw.trim();
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out;
}
