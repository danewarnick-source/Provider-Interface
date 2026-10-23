// Dose status rules for emar_logs. Doses are stored as 'administered' (taken)
// or an exception status; older rows may still say 'self_administered' or
// 'given'. Pure; used by logMedicationPass, Give meds and the MAR.

/** Statuses that mean the dose was taken (old and current spellings). */
export const TAKEN_STATUSES = ["administered", "self_administered", "given"] as const;

/** Every status that closes a scheduled dose, so it can't be charted again. */
export const CHARTED_STATUSES = [
  ...TAKEN_STATUSES,
  "refused",
  "omitted",
  "missed",
  "held",
  "loa",
] as const;

export function isTakenStatus(status: string | null | undefined): boolean {
  return (TAKEN_STATUSES as readonly string[]).includes(String(status ?? "").toLowerCase());
}

/** True when an existing row already charts this scheduled dose. */
export function isDoseAlreadyCharted(existing: ReadonlyArray<{ status: string | null }>): boolean {
  return existing.some((r) =>
    (CHARTED_STATUSES as readonly string[]).includes(String(r.status ?? "").toLowerCase()),
  );
}

export interface PassMedication {
  client_id: string;
  is_active: boolean | null;
  discontinued_at: string | null;
  paused_at: string | null;
}

/** Why this medication can't be charted for this client now, or null when it can. */
export function passBlockReason(med: PassMedication, clientId: string): string | null {
  if (med.client_id !== clientId) return "This medication belongs to a different client.";
  if (med.is_active === false || med.discontinued_at) return "This medication has been stopped.";
  if (med.paused_at) return "This medication is paused.";
  return null;
}
