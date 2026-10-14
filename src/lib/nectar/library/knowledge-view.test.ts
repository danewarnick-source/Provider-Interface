import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  documentChip,
  documentCount,
  documentMeta,
  documentNote,
  formatDay,
  formatInstant,
  formatShortDay,
  matrixCell,
  missingCount,
  noSectionsNote,
  personReview,
  questionDraftText,
  recordStatus,
  requiredSummary,
  REVIEW_RECORD_PRINT_CSS,
  REVIEW_RECORD_PRINT_ID,
  reviewDueLabel,
  reviewedLabel,
  slotChip,
  SLOT_DRAFT_TEXT,
  slotLine,
  versionNote,
} from "./knowledge-view.ts";

const SLOT = { code: "§1.18(4)", label: "Emergencies, health decline and death" };

describe("knowledge-view.ts (N4 wording from the demo)", () => {
  it("status chips: Loaded by PI, Archived, Draft, Past review, Published", () => {
    assert.deepEqual(documentChip({ kind: "state_rule", status: "published" }), {
      label: "Loaded by PI",
      tone: "state",
    });
    assert.equal(documentChip({ status: "archived", pastReview: true }).label, "Archived");
    assert.equal(documentChip({ status: "draft" }).label, "Draft");
    assert.equal(documentChip({ status: "published", pastReview: true }).label, "Past review");
    assert.equal(documentChip({ status: "published", pastReview: false }).label, "Published");
    assert.deepEqual(slotChip("missing"), { label: "Missing", tone: "missing" });
    assert.deepEqual(slotChip("past_review"), { label: "Past review", tone: "past_review" });
  });

  it("dates read like the demo, on the Denver calendar for timestamps", () => {
    assert.equal(formatDay("2027-03-01"), "Mar 1, 2027");
    assert.equal(formatShortDay("2026-10-03"), "Oct 3");
    assert.equal(formatDay(null), "");
    assert.equal(formatDay("not a date"), "");
    // 03:00 UTC on Oct 4 is still Oct 3 in Denver.
    assert.equal(formatInstant("2026-10-04T03:00:00Z"), "Oct 3, 2026");
    assert.equal(formatInstant("2026-10-04T03:00:00Z", true), "Oct 3");
  });

  it("library rows: slot line, next review, N of M reviewed", () => {
    assert.equal(
      slotLine({ slot: SLOT }),
      "Required: §1.18(4) Emergencies, health decline and death",
    );
    assert.equal(slotLine({ slot: null }), "Not a required policy");
    assert.equal(slotLine({ kind: "state_rule", slot: null }), "Read-only, kept current by PI");
    assert.equal(reviewDueLabel("2027-03-01"), "Review Mar 1, 2027");
    assert.equal(reviewDueLabel(null), "");
    assert.equal(reviewedLabel({ reviewed: 4, total: 6 }, true), "4 of 6 reviewed");
    assert.equal(
      reviewedLabel({ reviewed: 1, total: 1 }, false),
      "1 of 1 reviewed (selected people)",
    );
    assert.equal(reviewedLabel(null, true), "");
    assert.equal(documentCount(1), "1 document");
    assert.equal(documentCount(0), "0 documents");
  });

  it("document view: meta line and the note for drafts, past review, archived and replaced versions", () => {
    assert.equal(
      documentMeta({
        group: "agency",
        version: 2,
        owner: "Office manager",
        reviewDue: "2027-03-01",
        slot: SLOT,
      }),
      "Agency policies · v2 · Owner: Office manager · Next review Mar 1, 2027 · Fills §1.18(4) Emergencies, health decline and death",
    );
    assert.equal(
      documentMeta({ group: "reference", version: 1, owner: null, reviewDue: null, slot: null }),
      "Reference · v1",
    );
    const note = (status: string, pastReview = false, superseded = false) =>
      documentNote({ status, pastReview, superseded });
    assert.match(
      note("draft")!,
      /^Draft\. Nectar and team members can't see it until you publish it\.$/,
    );
    assert.match(note("published", true)!, /review date has passed/);
    assert.match(note("archived")!, /^Archived\./);
    assert.match(note("archived", false, true)!, /older version/);
    assert.equal(note("published"), null);
    assert.match(noSectionsNote("no_text"), /^No readable text\./);
    assert.match(noSectionsNote("failed"), /could not be read/);
  });

  it("review cells and the printable record", () => {
    assert.deepEqual(matrixCell({ status: "reviewed", reviewedAt: "2026-10-03T18:00:00Z" }), {
      label: "Reviewed Oct 3",
      tone: "ok",
    });
    assert.deepEqual(matrixCell({ status: "needs_review" }), {
      label: "Needs review",
      tone: "warn",
    });
    assert.deepEqual(matrixCell({ status: "not_for_them" }), {
      label: "Not for them",
      tone: "muted",
    });
    assert.equal(
      personReview({ status: "reviewed", reviewedAt: "2026-10-03T18:00:00Z" }).label,
      "Oct 3",
    );
    assert.equal(recordStatus("2026-10-03T18:00:00Z"), "Reviewed Oct 3, 2026");
    assert.equal(recordStatus(null), "Not reviewed yet");
  });

  it("versions panel notes", () => {
    const base = { library_status: "published", superseded_at: null, archived_at: null };
    assert.equal(versionNote(base), "Published");
    assert.equal(versionNote({ ...base, library_status: "draft" }), "Draft");
    assert.equal(
      versionNote({
        library_status: "archived",
        superseded_at: "2026-09-20T17:00:00Z",
        archived_at: null,
      }),
      "Replaced Sep 20, 2026",
    );
    assert.equal(
      versionNote({
        library_status: "archived",
        superseded_at: null,
        archived_at: "2026-09-21T17:00:00Z",
      }),
      "Archived Sep 21, 2026",
    );
  });

  it("required policies: summary, missing count and the Add template", () => {
    assert.equal(requiredSummary(6, 9), "6 of 9 required policies published and current");
    assert.equal(
      missingCount([
        { applies: true, status: "missing" },
        { applies: false, status: "missing" },
        { applies: true, status: "draft" },
      ]),
      1,
    );
    assert.match(SLOT_DRAFT_TEXT, /^Purpose\n/);
    assert.match(SLOT_DRAFT_TEXT, /\n\nWhat team members do\n/);
    assert.equal(
      questionDraftText("  Can I bring my dog\n to a shift? "),
      'Purpose\nAnswers the question: "Can I bring my dog to a shift?"\n\nWhat team members do\n[Write the steps here]',
    );
  });

  it("the print stylesheet prints only the record", () => {
    assert.match(REVIEW_RECORD_PRINT_CSS, /@media print/);
    assert.ok(
      REVIEW_RECORD_PRINT_CSS.includes(
        `body > *:not(#${REVIEW_RECORD_PRINT_ID}) { display: none !important; }`,
      ),
    );
    assert.ok(
      REVIEW_RECORD_PRINT_CSS.includes(
        `@media screen { #${REVIEW_RECORD_PRINT_ID} { display: none; } }`,
      ),
    );
  });
});
