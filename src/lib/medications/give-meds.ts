// Give meds rules: which doses are due now, which PRNs can be given, which
// PRN follow-ups are due, why a dose wasn't given, the time-taken window and
// late doses. Pure; shared by the Give meds component, logMedicationPass
// and the clock-out and daily-note checks.

import { denverWallToIso, denverYmd } from "../denver-date.ts";
import { CHARTED_STATUSES, isTakenStatus } from "./dose-status.ts";
import {
  expectedDoses,
  prnCheck,
  type MedicationFields,
  type PrnCheckResult,
} from "./med-rules.ts";

export const GIVE_MED_COLUMNS =
  "id, client_id, medication_name, strength, dosage, dose_form, route, scheduled_times, is_prn, is_controlled, is_rescue, is_psychotropic, purpose, side_effects, adverse_effects, how_taken, prn_instructions, prn_try_first, prn_call_if, prn_min_hours, prn_max_per_day, prn_followup_minutes, pill_count_current, start_date, end_date, is_active, discontinued_at, paused_at";

export const GIVE_LOG_COLUMNS =
  "id, medication_id, scheduled_for, scheduled_time_label, status, actual_taken_at, administered_at, exception_reason, is_prn, prn_reason, prn_followup_due_at, prn_followup_at, prn_effect, staff_id, staff_name, given_without_current_training, training_issue";

export type GiveMed = MedicationFields & {
  id: string;
  client_id?: string;
  medication_name: string;
  dose_form?: string | null;
  is_rescue?: boolean | null;
  prn_try_first?: string | null;
  prn_call_if?: string | null;
};

export interface GiveLog {
  id: string;
  medication_id: string | null;
  scheduled_for: string;
  scheduled_time_label?: string | null;
  status: string;
  actual_taken_at?: string | null;
  administered_at?: string | null;
  exception_reason?: string | null;
  is_prn?: boolean | null;
  prn_reason?: string | null;
  prn_followup_due_at?: string | null;
  prn_followup_at?: string | null;
  prn_effect?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  given_without_current_training?: boolean | null;
  training_issue?: string | null;
}

export interface DueDose {
  med: GiveMed;
  /** "HH:MM". */
  time: string;
  scheduledFor: string;
}

const MINUTE = 60_000;
/** A dose taken more than this long after its due time is late. */
export const LATE_DOSE_MINUTES = 60;
/** How far back a staff member can say a dose was taken. */
export const MAX_BACKDATE_HOURS = 24;
/** Clock slack for "in the future". */
const FUTURE_SLACK_MS = 2 * MINUTE;

const charted = (status: string) =>
  (CHARTED_STATUSES as readonly string[]).includes(String(status ?? "").toLowerCase());

const takenAt = (l: GiveLog) => l.actual_taken_at ?? l.administered_at ?? l.scheduled_for;

/** "8:05 AM" in the viewer's clock. */
export function clockTime(at: string | Date): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Active, not paused meds that can be charted now. */
export function chartableMeds<T extends GiveMed>(meds: readonly T[]): T[] {
  return meds.filter((m) => m.is_active !== false && !m.discontinued_at && !m.paused_at);
}

/**
 * Scheduled doses on a Denver day that nobody has charted yet. With a window
 * (clock-in to now, or start of day to now) only doses due inside it count.
 */
export function dueDoses(
  meds: readonly GiveMed[],
  logs: readonly GiveLog[],
  day: string,
  window?: { start?: string | null; end?: string | null },
): DueDose[] {
  const done = new Set(
    logs
      .filter((l) => l.medication_id && charted(l.status))
      .map((l) => `${l.medication_id}|${Date.parse(l.scheduled_for)}`),
  );
  const start = window?.start ? Date.parse(window.start) : -Infinity;
  const end = window?.end ? Date.parse(window.end) : Infinity;
  const out: DueDose[] = [];
  for (const med of chartableMeds(meds)) {
    for (const d of expectedDoses(med, day)) {
      if (d.held) continue;
      const at = Date.parse(d.scheduledFor);
      if (at < start || at > end) continue;
      if (done.has(`${med.id}|${at}`)) continue;
      out.push({ med, time: d.time, scheduledFor: d.scheduledFor });
    }
  }
  return out.sort(
    (a, b) =>
      a.scheduledFor.localeCompare(b.scheduledFor) ||
      a.med.medication_name.localeCompare(b.med.medication_name),
  );
}

/** Due-now window for a whole Denver day: start of day to now (or end of day if earlier). */
export function dayWindow(day: string, now: Date = new Date()): { start: string; end: string } {
  const start = denverWallToIso(day, 0, 0);
  const endOfDay = denverWallToIso(day, 23, 59);
  const end = now.toISOString() < endOfDay ? now.toISOString() : endOfDay;
  return { start, end };
}

export function asNeededMeds<T extends GiveMed>(meds: readonly T[]): T[] {
  return chartableMeds(meds)
    .filter((m) => m.is_prn)
    .sort((a, b) => a.medication_name.localeCompare(b.medication_name));
}

/** Doses charted on a Denver day, newest first. */
export function loggedOnDay(logs: readonly GiveLog[], day: string): GiveLog[] {
  return logs
    .filter((l) => charted(l.status) && denverYmd(new Date(takenAt(l))) === day)
    .sort((a, b) => takenAt(b).localeCompare(takenAt(a)));
}

/** PRN timing for one medication from its earlier taken doses. */
export function prnStatus(
  med: GiveMed,
  logs: readonly GiveLog[],
  now: Date = new Date(),
): PrnCheckResult {
  const lastDoses = logs
    .filter((l) => l.medication_id === med.id && isTakenStatus(l.status))
    .map(takenAt);
  return prnCheck({ lastDoses, minHours: med.prn_min_hours, maxPerDay: med.prn_max_per_day, now });
}

/** "Too soon" / "over the daily maximum" message with the next allowed time. */
export function prnWarning(check: PrnCheckResult, formatTime: (d: Date) => string): string | null {
  if (!check.nextAllowedAt) return null;
  const why = [
    check.tooSoon ? "it's too soon since the last dose" : null,
    check.overMax ? "it has reached its daily maximum" : null,
  ]
    .filter(Boolean)
    .join(" and ");
  return `Not yet: ${why}. Next allowed at ${formatTime(check.nextAllowedAt)}.`;
}

/** PRN doses whose "Did it help?" follow-up is due and not answered, oldest first. */
export function followupsDue(logs: readonly GiveLog[], now: Date = new Date()): GiveLog[] {
  const t = now.getTime();
  return logs
    .filter(
      (l) => l.is_prn && isTakenStatus(l.status) && l.prn_followup_due_at && !l.prn_followup_at,
    )
    .filter((l) => Date.parse(l.prn_followup_due_at as string) <= t)
    .sort((a, b) => String(a.prn_followup_due_at).localeCompare(String(b.prn_followup_due_at)));
}

export type NotGivenReason = "refused" | "asleep" | "not_home" | "held" | "ran_out" | "other";

/** Why a dose wasn't given: the label, the stored status and the MAR reason. */
export const NOT_GIVEN_REASONS: ReadonlyArray<{
  value: NotGivenReason;
  label: string;
  status: "refused" | "missed" | "omitted" | "held";
}> = [
  { value: "refused", label: "Refused", status: "refused" },
  { value: "asleep", label: "Asleep", status: "missed" },
  { value: "not_home", label: "Not home", status: "omitted" },
  { value: "held", label: "Held by nurse or prescriber", status: "held" },
  { value: "ran_out", label: "Ran out", status: "missed" },
  { value: "other", label: "Other", status: "missed" },
];

/** Stored status and exception reason for a dose that wasn't given. */
export function notGivenRecord(
  reason: NotGivenReason,
  note?: string | null,
): { status: "refused" | "missed" | "omitted" | "held"; exceptionReason: string } {
  const r = NOT_GIVEN_REASONS.find((x) => x.value === reason);
  if (!r) throw new Error("Pick why the dose wasn't given.");
  const extra = note?.trim();
  if (reason === "other" && !extra) throw new Error("Say why the dose wasn't given.");
  return { status: r.status, exceptionReason: extra ? `${r.label}: ${extra}` : r.label };
}

/** Why a time-taken can't be saved, or null. Future and more than 24 hours back are refused. */
export function takenAtProblem(takenAtIso: string, now: Date = new Date()): string | null {
  const t = Date.parse(takenAtIso);
  if (!Number.isFinite(t)) return "Enter when it was taken.";
  if (t > now.getTime() + FUTURE_SLACK_MS) return "The time taken can't be in the future.";
  if (t < now.getTime() - MAX_BACKDATE_HOURS * 60 * MINUTE)
    return "The time taken can't be more than 24 hours ago.";
  return null;
}

/** A scheduled dose taken more than 60 minutes after it was due. PRNs are never late. */
export function isLateDose(
  log: Pick<GiveLog, "status" | "scheduled_for" | "actual_taken_at" | "administered_at" | "is_prn">,
): boolean {
  if (log.is_prn || !isTakenStatus(log.status)) return false;
  const taken = Date.parse(log.actual_taken_at ?? log.administered_at ?? "");
  const due = Date.parse(log.scheduled_for);
  if (!Number.isFinite(taken) || !Number.isFinite(due)) return false;
  return taken - due > LATE_DOSE_MINUTES * MINUTE;
}

/** Given past the PRN minimum interval or daily maximum (with a reason). */
export function isPrnOverride(log: Pick<GiveLog, "exception_reason">): boolean {
  return /^PRN limit override:/i.test(log.exception_reason ?? "");
}
