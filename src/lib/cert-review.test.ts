import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  ADMIN_ACCEPTED_PREFIX,
  canAcceptCertEvidence,
  certReviewAcceptBlockReason,
  certReviewExpirationAdvisory,
  certReviewStatus,
  certReviewStatusLabel,
  correctionNoteFromAdminNotes,
  correctionReminderRecurrenceKey,
  indexCompletionsByInstance,
  isAdminAcceptedNote,
  isCorrectionRequestedNote,
  nectarReviewDisposition,
  nextRenewalDueFromRules,
  pickStaffCompletionForSurface,
  renewalDueFromExpiration,
  resolvedCertExpiration,
  shouldReplaceCompletionForResubmit,
  staffSurfaceReviewKind,
  usesCertExpirationCadence,
} from "./cert-review.ts";

describe("cert review rules", () => {
  it("allows accept without extracted expiry and does not invent a date", () => {
    const missing = {
      usesCertExpiration: true,
      extractedExpiresOn: null,
      confirmedExpiresOn: null,
    };
    assert.equal(canAcceptCertEvidence(missing), true);
    assert.equal(certReviewAcceptBlockReason(missing), null);
    assert.match(certReviewExpirationAdvisory(missing) ?? "", /not detected/);
    assert.equal(resolvedCertExpiration(missing), null);
    assert.equal(renewalDueFromExpiration(null), null);
    assert.equal(renewalDueFromExpiration("2026-09-10"), "2026-09-10");
    assert.equal(
      nextRenewalDueFromRules({
        usesCertExpiration: true,
        extractedExpiresOn: null,
        confirmedExpiresOn: null,
        authoritativeCompletedOn: "2026-09-11",
        everyNMonths: 24,
      }),
      null,
    );
  });

  it("accepts after the admin confirms expiration, and uses extracted when present", () => {
    assert.equal(
      canAcceptCertEvidence({
        usesCertExpiration: true,
        extractedExpiresOn: "2026-10-02",
        confirmedExpiresOn: null,
      }),
      true,
    );
    assert.equal(
      resolvedCertExpiration({
        usesCertExpiration: true,
        extractedExpiresOn: "2026-10-02",
        confirmedExpiresOn: "2027-01-15",
      }),
      "2027-01-15",
    );
    assert.equal(
      canAcceptCertEvidence({
        usesCertExpiration: false,
        extractedExpiresOn: null,
        confirmedExpiresOn: null,
      }),
      true,
    );
  });

  it("never treats upload date as an expiration", () => {
    const fn = readFileSync(new URL("./company-obligations.functions.ts", import.meta.url), "utf8");
    const due = readFileSync(new URL("./obligation-due-dates.ts", import.meta.url), "utf8");
    const baseline = readFileSync(
      new URL("./staff-training-requirements.functions.ts", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(fn, /renewal defaulted to/);
    assert.doesNotMatch(fn, /months from upload date/);
    assert.doesNotMatch(fn, /addMonthsUTC\(new Date\(completedAt\)/);
    assert.match(fn, /nextRenewalDueFromRules|nectarReviewDisposition/);
    assert.match(fn, /nectar_validation_status: "passed"/);
    assert.doesNotMatch(fn, /nectar_validation_status: "manually_confirmed"/);
    assert.doesNotMatch(due, /months from the last verified upload/);
    assert.match(due, /never taken from the upload date/);
    assert.doesNotMatch(baseline, /default_validity_months &&/);
  });

  it("routes uncertain uploads to review and accepts native platform completions", () => {
    const uncertain = nectarReviewDisposition({
      evidenceTypeUsed: "upload",
      isManualEntry: false,
      usesCertExpiration: false,
      validationRan: false,
      validationStatus: null,
      expiresOn: null,
      confidence: null,
    });
    assert.equal(uncertain.status, "needs_review");
    assert.equal(uncertain.holdOpen, true);

    const lowConfidence = nectarReviewDisposition({
      evidenceTypeUsed: "upload",
      isManualEntry: false,
      usesCertExpiration: true,
      validationRan: true,
      validationStatus: "passed",
      expiresOn: "2027-01-15",
      confidence: 0.4,
    });
    assert.equal(lowConfidence.status, "needs_review");

    const native = nectarReviewDisposition({
      evidenceTypeUsed: "in_hive_course",
      isManualEntry: false,
      usesCertExpiration: true,
      validationRan: false,
      validationStatus: null,
      expiresOn: null,
      confidence: null,
    });
    assert.equal(native.holdOpen, false);
    assert.equal(native.status, null);
  });

  it("schedules renewals from printed expiration or verified completion, never upload time", () => {
    assert.equal(
      nextRenewalDueFromRules({
        usesCertExpiration: true,
        extractedExpiresOn: "2027-06-01",
        authoritativeCompletedOn: "2025-09-11",
        everyNMonths: 24,
      }),
      "2027-06-01",
    );
    assert.equal(
      nextRenewalDueFromRules({
        usesCertExpiration: true,
        extractedExpiresOn: null,
        authoritativeCompletedOn: "2025-09-11",
        everyNMonths: 24,
      }),
      null,
    );
    assert.equal(
      nextRenewalDueFromRules({
        usesCertExpiration: false,
        extractedExpiresOn: null,
        authoritativeCompletedOn: "2025-09-11",
        everyNMonths: 12,
      }),
      "2026-09-11",
    );
    assert.equal(
      nextRenewalDueFromRules({
        usesCertExpiration: false,
        extractedExpiresOn: null,
        authoritativeCompletedOn: null,
        everyNMonths: 12,
      }),
      null,
    );
  });

  it("labels awaiting review until accept or correction", () => {
    assert.equal(
      certReviewStatus({ nectarValidationStatus: "failed", instanceStatus: "pending" }),
      "awaiting_review",
    );
    assert.equal(certReviewStatusLabel("awaiting_review"), "Awaiting review");
    assert.equal(
      certReviewStatus({
        nectarValidationStatus: "passed",
        instanceStatus: "pending",
        adminNotes: ADMIN_ACCEPTED_PREFIX,
      }),
      "accepted",
    );
    assert.equal(
      certReviewStatus({
        nectarValidationStatus: "passed",
        instanceStatus: "pending",
      }),
      "awaiting_review",
    );
    assert.equal(
      isAdminAcceptedNote(`${ADMIN_ACCEPTED_PREFIX} Expiration confirmed 2027-09-14.`),
      true,
    );
    assert.equal(
      certReviewStatus({
        nectarValidationStatus: "passed",
        instanceStatus: "completed",
      }),
      "accepted",
    );
    assert.equal(
      certReviewStatus({
        nectarValidationStatus: "failed",
        instanceStatus: "pending",
        correctionRequested: true,
      }),
      "correction_requested",
    );
    assert.equal(certReviewStatusLabel("correction_requested"), "Correction requested");
  });

  it("maps staff surfaces to correction, not leftover pending review", () => {
    assert.equal(
      staffSurfaceReviewKind({
        nectarValidationStatus: "failed",
        instanceStatus: "pending",
        adminNotes: "Correction requested: Show the expiration date.",
      }),
      "correction_requested",
    );
    assert.equal(
      staffSurfaceReviewKind({
        nectarValidationStatus: "failed",
        instanceStatus: "overdue",
        correctionRequested: true,
      }),
      "correction_requested",
    );
    assert.equal(
      staffSurfaceReviewKind({
        nectarValidationStatus: "needs_review",
        instanceStatus: "pending",
      }),
      "awaiting_review",
    );
    assert.equal(
      staffSurfaceReviewKind({
        instanceStatus: "pending",
      }),
      "none",
    );
    assert.equal(
      isCorrectionRequestedNote("Correction requested: Re-upload a clearer scan."),
      true,
    );
    assert.equal(
      isCorrectionRequestedNote("Correction requested — show the printed expiration."),
      true,
    );
    assert.equal(isCorrectionRequestedNote(ADMIN_ACCEPTED_PREFIX), false);
    assert.equal(isAdminAcceptedNote(ADMIN_ACCEPTED_PREFIX), true);
    assert.equal(
      staffSurfaceReviewKind({
        nectarValidationStatus: "passed",
        instanceStatus: "pending",
        adminNotes: ADMIN_ACCEPTED_PREFIX,
      }),
      "accepted",
    );
    assert.equal(
      correctionNoteFromAdminNotes("Correction requested: Show the printed expiration."),
      "Show the printed expiration.",
    );
  });

  it("replaces the same-period completion and dedupes the correction reminder", () => {
    assert.equal(
      shouldReplaceCompletionForResubmit({
        nectarValidationStatus: "failed",
        adminNotes: "Correction requested: Re-upload.",
      }),
      true,
    );
    assert.equal(
      shouldReplaceCompletionForResubmit({
        nectarValidationStatus: "failed",
        adminNotes: null,
      }),
      true,
    );
    assert.equal(
      shouldReplaceCompletionForResubmit({
        nectarValidationStatus: "needs_review",
        adminNotes: "Uploaded — awaiting review.",
      }),
      true,
    );
    assert.equal(
      shouldReplaceCompletionForResubmit({
        nectarValidationStatus: "passed",
        adminNotes: ADMIN_ACCEPTED_PREFIX,
      }),
      false,
    );
    assert.equal(
      correctionReminderRecurrenceKey("inst-1", "staff-1"),
      "obligation_correction_inst-1_staff-1",
    );
    assert.equal(
      correctionReminderRecurrenceKey("inst-1", "staff-1"),
      correctionReminderRecurrenceKey("inst-1", "staff-1"),
    );
  });

  it("prefers the correction-requested completion when the same instance has a leftover failed row", () => {
    const picked = pickStaffCompletionForSurface([
      {
        instance_id: "cpr-1",
        admin_notes: null,
        nectar_validation_status: "failed",
        completed_at: "2026-09-14T18:00:00.000Z",
      },
      {
        instance_id: "cpr-1",
        admin_notes: "Correction requested: Show the expiration date.",
        nectar_validation_status: "failed",
        completed_at: "2026-09-10T18:00:00.000Z",
      },
    ]);
    assert.equal(picked?.admin_notes?.startsWith("Correction requested:"), true);

    const byInstance = indexCompletionsByInstance([
      {
        instance_id: "cpr-1",
        admin_notes: null,
        nectar_validation_status: "failed",
        completed_at: "2026-09-14T18:00:00.000Z",
      },
      {
        instance_id: "cpr-1",
        admin_notes: "Correction requested: Show the expiration date.",
        nectar_validation_status: "failed",
        completed_at: "2026-09-10T18:00:00.000Z",
      },
    ]);
    assert.equal(isCorrectionRequestedNote(byInstance.get("cpr-1")?.admin_notes), true);
  });

  it("blocks accept while correction is outstanding and re-enables after the replacement clears the note", () => {
    const duringCorrection = {
      usesCertExpiration: true,
      extractedExpiresOn: "2027-01-15" as string | null,
      confirmedExpiresOn: "2027-01-15" as string | null,
      correctionRequested: true,
    };
    assert.equal(canAcceptCertEvidence(duringCorrection), false);
    assert.match(certReviewAcceptBlockReason(duringCorrection) ?? "", /re-upload/);

    const afterReplace = {
      usesCertExpiration: true,
      extractedExpiresOn: null as string | null,
      confirmedExpiresOn: "2027-01-15" as string | null,
      correctionRequested: false,
    };
    assert.equal(canAcceptCertEvidence(afterReplace), true);
    assert.equal(certReviewAcceptBlockReason(afterReplace), null);

    const afterReplaceNoExpiry = {
      usesCertExpiration: true,
      extractedExpiresOn: null as string | null,
      confirmedExpiresOn: null as string | null,
      correctionRequested: false,
    };
    assert.equal(canAcceptCertEvidence(afterReplaceNoExpiry), true);
    assert.equal(certReviewAcceptBlockReason(afterReplaceNoExpiry), null);
    assert.match(certReviewExpirationAdvisory(afterReplaceNoExpiry) ?? "", /not detected/);
    assert.equal(resolvedCertExpiration(afterReplaceNoExpiry), null);
  });

  it("detects cert-expiration cadence from due_day_config", () => {
    assert.equal(usesCertExpirationCadence({ from: "cert_expiration", every_n_months: 24 }), true);
    assert.equal(usesCertExpirationCadence({ every_n_months: 24 }), true);
    assert.equal(usesCertExpirationCadence({ from: "completed_at" }), false);
    assert.equal(usesCertExpirationCadence({ days_after_hire: 30, every_n_months: 12 }), false);
    assert.equal(usesCertExpirationCadence(null), false);
  });
});

describe("cert review surface lock", () => {
  it("keeps preview + accept/correction on the existing completion row", () => {
    const page = readFileSync(
      new URL("../routes/dashboard.compliance_.cert-review.$completionId.tsx", import.meta.url),
      "utf8",
    );
    const panel = readFileSync(
      new URL("../components/compliance/cert-review-panel.tsx", import.meta.url),
      "utf8",
    );
    const engine = readFileSync(new URL("./cert-review.ts", import.meta.url), "utf8");
    const staffFile = readFileSync(
      new URL("../components/compliance/staff-file-panel.tsx", import.meta.url),
      "utf8",
    );
    assert.match(page, /CertReviewPanel/);
    assert.match(engine, /Awaiting review/);
    assert.match(panel, /certReviewStatusLabel/);
    assert.match(panel, /Accept evidence/);
    assert.match(panel, /Request correction/);
    assert.match(panel, /Leave blank to accept without inventing/);
    assert.match(engine, /CORRECTION_REQUESTED_PREFIX/);
    assert.match(engine, /shouldReplaceCompletionForResubmit/);
    assert.match(engine, /pickStaffCompletionForSurface/);
    assert.match(engine, /Waiting for the staff member to re-upload/);
    const fns = readFileSync(
      new URL("./company-obligations.functions.ts", import.meta.url),
      "utf8",
    );
    assert.match(fns, /shouldReplaceCompletionForResubmit/);
    assert.match(fns, /pickStaffCompletionForSurface|indexCompletionsByInstance/);
    assert.match(fns, /correctionReminderRecurrenceKey/);
    assert.match(fns, /resolveInstanceNotifications/);
    assert.match(fns, /ADMIN_ACCEPTED_PREFIX/);
    assert.match(fns, /nectar_validation_status: "passed"/);
    assert.doesNotMatch(fns, /nectar_validation_status: "manually_confirmed"/);
    assert.match(engine, /ADMIN_ACCEPTED_PREFIX/);
    assert.match(panel, /adminNotes: review.adminNotes/);
    assert.match(panel, /certReviewAcceptBlockReason/);
    assert.match(panel, /certReviewExpirationAdvisory/);
    assert.match(engine, /accept without inventing/);
    assert.match(engine, /certReviewExpirationAdvisory/);
    assert.match(staffFile, /cert-review/);
    assert.doesNotMatch(panel, /from\("certificate_reviews"\)/);
    const personFile = readFileSync(
      new URL("../components/employees/staff-obligations-files-tab.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(personFile, /Replace evidence/);
    assert.match(personFile, /Previous cycle/);
    assert.match(personFile, /InHiveCertificate|loadInHiveCourseCertificate/);
    assert.doesNotMatch(personFile, /isManualEntry: true/);
  });
});
