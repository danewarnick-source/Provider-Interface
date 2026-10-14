// What logMedicationPass accepts and what it sends to log_medication_dose.
// Pure (zod + rules); the server function adds the database checks.

import { z } from "zod";
import { denverYmdFromInstant } from "../denver-date.ts";
import {
  NOT_GIVEN_REASONS,
  notGivenRecord,
  takenAtProblem,
  type NotGivenReason,
} from "./give-meds.ts";
import { expectedDoses, type HowTaken, type MedicationFields } from "./med-rules.ts";

export const NURSE_ROLES = ["lpn", "rn", "delegated"] as const;
export type NurseRole = (typeof NURSE_ROLES)[number];
export type AdministratorRole = "staff_observed" | "staff_administered" | NurseRole;

const reasonValues = NOT_GIVEN_REASONS.map((r) => r.value) as [NotGivenReason, ...NotGivenReason[]];
const text = (max: number) => z.string().max(max).nullable().optional();
const id = z.string().uuid().nullable().optional();

export const PassInput = z.object({
  clientId: z.string().uuid(),
  medicationId: z.string().uuid(),
  /** The scheduled dose time (UTC ISO). Omitted for an as-needed dose: the time taken is used. */
  scheduledFor: z.string().nullable().optional(),
  scheduledTimeLabel: text(10),
  outcome: z.enum(["given", "not_given"]),
  notGivenReason: z.enum(reasonValues).nullable().optional(),
  note: text(2000),
  route: z.string().trim().min(1).max(80),
  /** When the staff member says it was taken. */
  actualTakenAt: z.string().nullable().optional(),
  nurseRole: z.enum(NURSE_ROLES).nullable().optional(),
  credentialId: id,
  prnReason: text(500),
  prnOverrideReason: text(500),
  prnTriedFirst: text(500),
  prescriberNotified: z.boolean().nullable().optional(),
  seizureDurationSeconds: z.number().int().nonnegative().nullable().optional(),
  seizureOutcome: text(500),
  emergencyServicesCalled: z.boolean().nullable().optional(),
  countBefore: z.number().int().nullable().optional(),
  countAfter: z.number().int().nullable().optional(),
  witnessConfirmationId: id,
  serviceContext: text(40),
  scheduledShiftId: id,
  /** Made once per dose on the phone; a retry with the same id never makes a second row. */
  clientRequestId: z.string().uuid(),
});
export type PassInput = z.infer<typeof PassInput>;

export type PassMed = MedicationFields & {
  id: string;
  medication_name: string;
  is_rescue?: boolean | null;
};

/** Who gave it, from how the client takes this medication. */
export function administratorRole(
  howTaken: HowTaken | string | null | undefined,
  nurseRole: NurseRole | null | undefined,
): AdministratorRole {
  if (howTaken === "assist") return "staff_administered";
  if (howTaken === "nurse") {
    if (!nurseRole) throw new Error("A nurse gives this medication. Pick your nurse role.");
    return nurseRole;
  }
  return "staff_observed";
}

export const isHandsOn = (role: AdministratorRole) => role !== "staff_observed";

export function attestationText(role: AdministratorRole, given: boolean): string {
  if (!given)
    return "I confirm this dose was not given for the reason recorded, and this record is accurate.";
  if (role === "staff_observed") {
    return "I watched this client take their own medication and checked it matches the label: medication, dose, route and time. This record is accurate.";
  }
  return `I gave this medication to this client as ${role === "staff_administered" ? "staff" : role.toUpperCase()}, checked the client, medication, dose, route and time, and this record is accurate.`;
}

export function recordedIn(serviceContext: string | null | undefined): "hhs" | "dsi" | "general" {
  if (serviceContext && /HH/i.test(serviceContext)) return "hhs";
  if (serviceContext && /^DS/i.test(serviceContext)) return "dsi";
  return "general";
}

/** The first thing stopping this pass from saving, or null. */
export function passProblem(input: PassInput, med: PassMed, now: Date = new Date()): string | null {
  const given = input.outcome === "given";
  if (!given) {
    if (med.is_prn) return "As-needed medications are only logged when they're given.";
    if (!input.notGivenReason) return "Pick why the dose wasn't given.";
    if (input.notGivenReason === "other" && !input.note?.trim())
      return "Say why the dose wasn't given.";
  } else {
    const timeProblem = takenAtProblem(input.actualTakenAt ?? "", now);
    if (timeProblem) return timeProblem;
    if (med.is_prn && !input.prnReason?.trim())
      return "Add why the as-needed medication was given.";
    if (med.is_rescue && (input.seizureDurationSeconds == null || !input.seizureOutcome?.trim())) {
      return "A rescue medication needs the seizure length and what happened.";
    }
    if (med.is_controlled && (input.countBefore == null || input.countAfter == null)) {
      return "Count the medication before and after the dose.";
    }
  }
  if (!med.is_prn) {
    if (!input.scheduledFor) return "Pick which scheduled dose this is.";
    const day = denverYmdFromInstant(input.scheduledFor);
    const at = Date.parse(input.scheduledFor);
    const match = day
      ? expectedDoses(med, day).some((d) => Date.parse(d.scheduledFor) === at)
      : false;
    if (!match) return "That isn't one of this medication's scheduled times.";
  }
  return null;
}

/** The dose row sent to log_medication_dose (plus its count and witness keys). */
export function buildDosePayload(args: {
  input: PassInput;
  med: PassMed;
  role: AdministratorRole;
  fullName: string;
  nowIso: string;
}): Record<string, unknown> {
  const { input, med, role, fullName, nowIso } = args;
  const given = input.outcome === "given";
  const notGiven = given
    ? null
    : notGivenRecord(input.notGivenReason as NotGivenReason, input.note);
  const takenAt = given ? (input.actualTakenAt as string) : null;
  return {
    client_id: input.clientId,
    medication_id: input.medicationId,
    scheduled_for: med.is_prn ? takenAt : input.scheduledFor,
    scheduled_time_label: med.is_prn ? null : (input.scheduledTimeLabel ?? null),
    status: given ? "administered" : notGiven!.status,
    administered_at: takenAt,
    actual_taken_at: takenAt,
    administrator_role: role,
    credential_id: input.credentialId ?? null,
    route: input.route,
    exception_reason: notGiven?.exceptionReason ?? null,
    notes: given ? input.note?.trim() || null : null,
    staff_name: fullName,
    signature_attestation: `${fullName} @ ${nowIso}: ${attestationText(role, given)}`,
    attestation_signed: true,
    prn_reason: med.is_prn ? (input.prnReason?.trim() ?? null) : null,
    prn_tried_first: med.is_prn ? input.prnTriedFirst?.trim() || null : null,
    prescriber_notified: med.is_prn ? (input.prescriberNotified ?? null) : null,
    seizure_duration_seconds: input.seizureDurationSeconds ?? null,
    seizure_outcome: input.seizureOutcome ?? null,
    emergency_services_called: input.emergencyServicesCalled ?? null,
    service_context: input.serviceContext ?? null,
    recorded_in: recordedIn(input.serviceContext),
    scheduled_shift_id: input.scheduledShiftId ?? null,
    client_request_id: input.clientRequestId,
    count_before: med.is_controlled && given ? input.countBefore : null,
    count_after: med.is_controlled && given ? input.countAfter : null,
    witness_confirmation_id:
      med.is_controlled && given ? (input.witnessConfirmationId ?? null) : null,
  };
}

/** Plain-English message for a log_medication_dose error. */
export function doseErrorMessage(message: string): string {
  if (message.startsWith("PRN_LIMIT")) {
    return "This as-needed medication was given too recently or has reached its daily maximum. Add a reason to give it anyway.";
  }
  if (message.startsWith("TRAINING:")) return message.slice("TRAINING:".length).trim();
  return message;
}
