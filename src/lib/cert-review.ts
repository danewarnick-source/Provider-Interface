/**
 * Certificate review — uploaded ≠ accepted ≠ currently valid.
 * AI may extract/suggest; verified rules decide. Never invent expiration
 * from the upload date.
 */

import { addMonthsUTC } from "./obligation-due-dates.ts";

export type CertReviewStatus = "awaiting_review" | "accepted" | "correction_requested";

/** Written onto company_obligation_completions.admin_notes by requestObligationCorrection. */
export const CORRECTION_REQUESTED_PREFIX = "Correction requested:";

const CORRECTION_NOTE_RE = /^\s*correction requested\b/i;
const CORRECTION_NOTE_BODY_RE = /^\s*correction requested\s*[:—–-]?\s*/i;

export function isCorrectionRequestedNote(adminNotes: string | null | undefined): boolean {
  return CORRECTION_NOTE_RE.test(String(adminNotes ?? ""));
}

export function correctionNoteFromAdminNotes(adminNotes: string | null | undefined): string | null {
  if (!isCorrectionRequestedNote(adminNotes)) return null;
  const note = String(adminNotes).replace(CORRECTION_NOTE_BODY_RE, "").trim();
  return note || null;
}

/** Same-period completion used on staff surfaces. Correction note wins over a leftover Nectar failed row. */
export function pickStaffCompletionForSurface<
  T extends {
    admin_notes?: string | null;
    nectar_validation_status?: string | null;
    completed_at?: string | null;
  },
>(rows: readonly T[]): T | undefined {
  if (!rows.length) return undefined;
  const correction = rows.find((row) => isCorrectionRequestedNote(row.admin_notes));
  if (correction) return correction;
  return [...rows].sort((a, b) =>
    String(b.completed_at ?? "").localeCompare(String(a.completed_at ?? "")),
  )[0];
}

export function indexCompletionsByInstance<
  T extends {
    instance_id: string;
    admin_notes?: string | null;
    nectar_validation_status?: string | null;
    completed_at?: string | null;
  },
>(rows: readonly T[]): Map<string, T> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.instance_id) ?? [];
    list.push(row);
    grouped.set(row.instance_id, list);
  }
  const out = new Map<string, T>();
  for (const [instanceId, list] of grouped) {
    const picked = pickStaffCompletionForSurface(list);
    if (picked) out.set(instanceId, picked);
  }
  return out;
}

/** One reminder row per instance + staff after correction/reject. */
export function correctionReminderRecurrenceKey(instanceId: string, staffId: string): string {
  return `obligation_correction_${instanceId}_${staffId}`;
}

/**
 * Re-upload after correction/reject updates this completion instead of
 * inserting a second row for the same obligation period.
 */
export function shouldReplaceCompletionForResubmit(args: {
  nectarValidationStatus?: string | null;
  adminNotes?: string | null;
}): boolean {
  if (isCorrectionRequestedNote(args.adminNotes)) return true;
  return args.nectarValidationStatus === "failed" || args.nectarValidationStatus === "needs_review";
}

export type StaffSurfaceReviewKind = "none" | CertReviewStatus;

/** Staff-facing review state. Correction wins over a leftover Nectar failed/needs_review flag. */
export function staffSurfaceReviewKind(args: {
  nectarValidationStatus?: string | null;
  instanceStatus?: string | null;
  adminNotes?: string | null;
  correctionRequested?: boolean;
}): StaffSurfaceReviewKind {
  const correctionRequested =
    args.correctionRequested === true || isCorrectionRequestedNote(args.adminNotes);
  const status = certReviewStatus({
    nectarValidationStatus: args.nectarValidationStatus,
    instanceStatus: args.instanceStatus,
    correctionRequested,
  });
  if (status === "correction_requested") return "correction_requested";
  if (status === "accepted") return "accepted";
  if (
    args.nectarValidationStatus === "failed" ||
    args.nectarValidationStatus === "needs_review" ||
    args.nectarValidationStatus === "passed"
  ) {
    return "awaiting_review";
  }
  return "none";
}

/** Same token in-Hive / PI course completions write onto company_obligation_completions. */
export const NATIVE_PLATFORM_EVIDENCE = "in_hive_course";

/** Below this, a "passed" OCR read is still uncertain and stays in review. */
export const NECTAR_CERT_CONFIDENCE_FLOOR = 0.7;

export type CertExtractedFields = {
  name: string | null;
  credential: string | null;
  completedOn: string | null;
  expiresOn: string | null;
};

export type CertReviewDecisionInput = {
  usesCertExpiration: boolean;
  extractedExpiresOn: string | null | undefined;
  confirmedExpiresOn: string | null | undefined;
  nectarStatus?: string | null;
  correctionRequested?: boolean;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: string | null | undefined): value is string {
  return !!value && ISO_DAY.test(value);
}

/** Admin-confirmed or extracted printed expiration — never upload/completed_at. */
export function resolvedCertExpiration(input: CertReviewDecisionInput): string | null {
  if (isIsoDay(input.confirmedExpiresOn)) return input.confirmedExpiresOn;
  if (isIsoDay(input.extractedExpiresOn)) return input.extractedExpiresOn;
  return null;
}

export function expirationMissing(input: CertReviewDecisionInput): boolean {
  if (!input.usesCertExpiration) return false;
  return resolvedCertExpiration(input) === null;
}

/**
 * Accept is allowed once review is otherwise complete (evidence on the
 * row, correction/resubmit cleared). Missing extracted expiration is not
 * a block — admin may confirm a printed date, or accept without one.
 * Never invent a date from the upload.
 */
export function canAcceptCertEvidence(input: CertReviewDecisionInput): boolean {
  if (input.correctionRequested) return false;
  return true;
}

export function isNativePlatformEvidence(evidenceTypeUsed: string | null | undefined): boolean {
  return evidenceTypeUsed === NATIVE_PLATFORM_EVIDENCE;
}

export function isUploadEvidenceType(evidenceTypeUsed: string | null | undefined): boolean {
  return evidenceTypeUsed === "upload" || evidenceTypeUsed === "upload_and_attestation";
}

export function isUncertainNectarStatus(status: string | null | undefined): boolean {
  return status === "failed" || status === "needs_review";
}

export type NectarDisposition = {
  status: "passed" | "failed" | "needs_review" | null;
  holdOpen: boolean;
  extraReasons: string[];
};

/**
 * Uploaded ≠ accepted. Native platform completions are durable and certain.
 * Uncertain uploads stay open for cert review — never invent a due date to close them.
 */
export function nectarReviewDisposition(args: {
  evidenceTypeUsed: string;
  isManualEntry: boolean;
  usesCertExpiration: boolean;
  validationRan: boolean;
  validationStatus: "passed" | "failed" | "needs_review" | null;
  expiresOn: string | null | undefined;
  confidence: number | null | undefined;
}): NectarDisposition {
  if (isNativePlatformEvidence(args.evidenceTypeUsed)) {
    return { status: args.validationStatus, holdOpen: false, extraReasons: [] };
  }

  const extraReasons: string[] = [];
  if (args.usesCertExpiration && !isIsoDay(args.expiresOn)) {
    extraReasons.push(
      "Expiration date could not be extracted. Confirm expiration before accepting — do not invent it from the upload date.",
    );
    return { status: "failed", holdOpen: true, extraReasons };
  }

  if (args.validationStatus === "failed") {
    return { status: "failed", holdOpen: true, extraReasons };
  }

  if (
    args.validationRan &&
    args.validationStatus === "passed" &&
    typeof args.confidence === "number" &&
    args.confidence < NECTAR_CERT_CONFIDENCE_FLOOR
  ) {
    extraReasons.push(
      "Nectar was not confident enough to accept this upload. An admin must review it.",
    );
    return { status: "needs_review", holdOpen: true, extraReasons };
  }

  if (args.validationRan && args.validationStatus === "passed") {
    return { status: "passed", holdOpen: false, extraReasons };
  }

  if (args.isManualEntry && !args.usesCertExpiration) {
    return { status: args.validationStatus, holdOpen: false, extraReasons };
  }

  if (isUploadEvidenceType(args.evidenceTypeUsed) && !args.validationRan) {
    extraReasons.push(
      "This upload was not verified. It stays in review until an admin accepts it.",
    );
    return { status: "needs_review", holdOpen: true, extraReasons };
  }

  return { status: args.validationStatus, holdOpen: false, extraReasons };
}

/**
 * Next renewal due day. Cert clocks use printed/confirmed expiration only.
 * Non-cert every-n-months uses a verified completion day, never the upload timestamp.
 */
export function nextRenewalDueFromRules(args: {
  usesCertExpiration: boolean;
  extractedExpiresOn?: string | null;
  confirmedExpiresOn?: string | null;
  authoritativeCompletedOn?: string | null;
  everyNMonths?: number | null;
}): string | null {
  const printed = resolvedCertExpiration({
    usesCertExpiration: args.usesCertExpiration,
    extractedExpiresOn: args.extractedExpiresOn,
    confirmedExpiresOn: args.confirmedExpiresOn,
  });
  if (printed) return printed;
  if (args.usesCertExpiration) return null;
  const months = args.everyNMonths;
  if (
    months != null &&
    Number.isFinite(months) &&
    months > 0 &&
    isIsoDay(args.authoritativeCompletedOn)
  ) {
    const next = addMonthsUTC(new Date(`${args.authoritativeCompletedOn}T00:00:00Z`), months);
    const y = next.getUTCFullYear();
    const m = String(next.getUTCMonth() + 1).padStart(2, "0");
    const d = String(next.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function certReviewAcceptBlockReason(input: CertReviewDecisionInput): string | null {
  if (input.correctionRequested) {
    return "Waiting for the staff member to re-upload. Accept after the replacement is in.";
  }
  return null;
}

/** Advisory only — does not disable Accept. */
export function certReviewExpirationAdvisory(input: CertReviewDecisionInput): string | null {
  if (!expirationMissing(input)) return null;
  return "Expiration was not detected on the upload. Enter the printed date if you can see it, or accept without inventing one.";
}

export function certReviewStatus(args: {
  nectarValidationStatus?: string | null;
  instanceStatus?: string | null;
  correctionRequested?: boolean;
}): CertReviewStatus {
  if (args.correctionRequested) return "correction_requested";
  if (args.nectarValidationStatus === "manually_confirmed") return "accepted";
  if (args.instanceStatus === "completed" || args.instanceStatus === "waived") {
    if (args.nectarValidationStatus === "failed") return "awaiting_review";
    return "accepted";
  }
  if (
    args.nectarValidationStatus === "failed" ||
    args.nectarValidationStatus === "needs_review" ||
    args.nectarValidationStatus === "passed"
  ) {
    return "awaiting_review";
  }
  return "awaiting_review";
}

export function certReviewStatusLabel(status: CertReviewStatus): string {
  if (status === "accepted") return "Accepted";
  if (status === "correction_requested") return "Correction requested";
  return "Awaiting review";
}

export function usesCertExpirationCadence(dueDayConfig: unknown): boolean {
  if (!dueDayConfig || typeof dueDayConfig !== "object") return false;
  const cfg = dueDayConfig as Record<string, unknown>;
  if (cfg.kind === "cert_expiration" || cfg.from === "cert_expiration") return true;
  // Live CPR/renewal rows often store every_n_months without kind — same as
  // dueRuleFromConfig's annually + every_n_months → cert_expiration mapping.
  if (cfg.every_n_months !== undefined && cfg.days_after_hire === undefined) return true;
  return false;
}

/** Guard: a due date must come from a printed/confirmed expiration, not upload time. */
export function renewalDueFromExpiration(expiresOn: string | null | undefined): string | null {
  return isIsoDay(expiresOn) ? expiresOn : null;
}

export const CERT_REVIEW_AI_NOTE =
  "AI extracted these details against the certificate. Verified rules decide. Never invent expiration from the upload date.";
