import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDuplicateReview,
  isReviewable,
  planReview,
  REVIEW_STATEMENT,
  reviewCell,
  reviewCounts,
  reviewHashInput,
  reviewInsertRow,
  reviewMatrix,
  staffRecord,
  type ReviewRow,
} from "./reviews.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ANA = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";
const MEMBERS = [ANA, BEN];

const v1 = {
  id: "doc-v1",
  version: 1,
  title: "Grievance Policy",
  audience_all: true,
  policy_assigned_users: [] as string[],
  library_status: "published",
  library_group: "agency" as string | null,
  superseded_by: null as string | null,
};
const v2 = { ...v1, id: "doc-v2", version: 2 };
const reviewed = (
  doc: { id: string; version: number },
  user: string,
  at = "2026-10-03T15:00:00Z",
): ReviewRow => ({
  document_id: doc.id,
  document_version: doc.version,
  user_id: user,
  signed_at: at,
});

describe("Mark as reviewed (Decision 4)", () => {
  it("records a dated review for one person and one version", () => {
    const reviews = [reviewed(v1, ANA)];
    assert.deepEqual(reviewCell(v1, ANA, reviews), {
      status: "reviewed",
      reviewedAt: "2026-10-03T15:00:00Z",
    });
    assert.deepEqual(reviewCell(v1, BEN, reviews), { status: "needs_review" });
    assert.deepEqual(reviewCounts(v1, MEMBERS, reviews), { reviewed: 1, total: 2 });
  });

  it("a new version resets reviews: everyone it's for is asked again", () => {
    const reviews = [reviewed(v1, ANA), reviewed(v1, BEN)];
    assert.deepEqual(reviewCounts(v1, MEMBERS, reviews), { reviewed: 2, total: 2 });
    assert.deepEqual(reviewCounts(v2, MEMBERS, reviews), { reviewed: 0, total: 2 });
    assert.deepEqual(reviewCell(v2, ANA, reviews), { status: "needs_review" });
    const sameRowNewNumber = { ...v1, version: 2 };
    assert.deepEqual(reviewCell(sameRowNewNumber, ANA, reviews), { status: "needs_review" });
  });

  it("is idempotent per version: a second review of the same version changes nothing", () => {
    const first = planReview(v1, ANA, []);
    assert.deepEqual(first, { ok: true, already: null });
    const again = planReview(v1, ANA, [reviewed(v1, ANA)]);
    assert.deepEqual(again, { ok: true, already: reviewed(v1, ANA) });
    const twice = [reviewed(v1, ANA, "2026-10-04T00:00:00Z"), reviewed(v1, ANA)];
    assert.deepEqual(reviewCell(v1, ANA, twice), {
      status: "reviewed",
      reviewedAt: "2026-10-03T15:00:00Z",
    });
    assert.deepEqual(reviewCounts(v1, MEMBERS, twice), { reviewed: 1, total: 2 });
    assert.equal(
      isDuplicateReview({ code: "23505" }),
      true,
      "the database index refuses a second row",
    );
    assert.equal(isDuplicateReview({ code: "42501" }), false);
  });

  it("only a published policy or procedure meant for the person can be reviewed", () => {
    assert.deepEqual(planReview({ ...v1, library_status: "draft" }, ANA, []), {
      ok: false,
      reason: "not_published",
    });
    assert.deepEqual(planReview({ ...v1, library_group: "reference" }, ANA, []), {
      ok: false,
      reason: "not_reviewable",
    });
    assert.deepEqual(planReview({ ...v1, library_group: "procedures" }, ANA, []), {
      ok: true,
      already: null,
    });
    assert.equal(isReviewable("state"), false);
    assert.deepEqual(planReview({ ...v1, superseded_by: "doc-v2" }, ANA, []), {
      ok: false,
      reason: "not_published",
    });
    const forAna = { ...v1, audience_all: false, policy_assigned_users: [ANA] };
    assert.deepEqual(planReview(forAna, BEN, []), { ok: false, reason: "not_for_you" });
    assert.deepEqual(reviewCell(forAna, BEN, []), { status: "not_for_them" });
    assert.deepEqual(reviewCounts(forAna, MEMBERS, []), { reviewed: 0, total: 1 });
  });

  it("writes person, policy, version and date with the review statement, and no typed signature", () => {
    const row = reviewInsertRow({
      organizationId: ORG,
      doc: v2,
      user: { id: ANA, name: "Team Member A", email: null },
      contentHash: "abc",
      signedAt: "2026-10-13T12:00:00Z",
    });
    assert.deepEqual(row, {
      organization_id: ORG,
      document_id: "doc-v2",
      document_version: 2,
      user_id: ANA,
      signer_full_name: "Team Member A",
      signer_email: null,
      signed_at: "2026-10-13T12:00:00Z",
      attestation_statement: REVIEW_STATEMENT,
      consent_accepted: true,
      content_version: "2",
      content_hash: "abc",
    });
    assert.equal(REVIEW_STATEMENT, "I have reviewed this version.");
    assert.equal("typed_signature" in row, false);
    assert.equal(reviewHashInput({ raw_text: "  Text  ", storage_path: "p" }), "Text");
    assert.equal(
      reviewHashInput({ raw_text: null, storage_path: "org/library/f.pdf" }),
      "file:org/library/f.pdf",
    );
  });
});

describe("review matrix and staff record", () => {
  const forBen = {
    ...v1,
    id: "doc-b",
    title: "Driving Policy",
    audience_all: false,
    policy_assigned_users: [BEN],
  };

  it("shows team members × published policies with Reviewed, Needs review or Not for them", () => {
    const matrix = reviewMatrix(
      [v1, forBen],
      [
        { userId: BEN, name: "B" },
        { userId: ANA, name: "A" },
      ],
      [reviewed(v1, ANA)],
    );
    assert.deepEqual(
      matrix.rows.map((r) => r.name),
      ["A", "B"],
    );
    assert.deepEqual(
      matrix.rows[0]!.cells.map((c) => c.status),
      ["reviewed", "not_for_them"],
    );
    assert.deepEqual(
      matrix.rows[1]!.cells.map((c) => c.status),
      ["needs_review", "needs_review"],
    );
    assert.deepEqual(
      matrix.documents.map((d) => d.counts),
      [
        { reviewed: 1, total: 2 },
        { reviewed: 0, total: 1 },
      ],
    );
  });

  it("lists one person's policies with the reviewed date or nothing yet", () => {
    assert.deepEqual(staffRecord(ANA, [forBen, v1], [reviewed(v1, ANA)]), [
      {
        documentId: "doc-v1",
        title: "Grievance Policy",
        version: 1,
        reviewedAt: "2026-10-03T15:00:00Z",
      },
    ]);
    assert.deepEqual(
      staffRecord(BEN, [forBen, v1], []).map((r) => [r.title, r.reviewedAt]),
      [
        ["Driving Policy", null],
        ["Grievance Policy", null],
      ],
    );
  });
});
