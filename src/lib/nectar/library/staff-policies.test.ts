import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  markReviewedLabel,
  needsReviewCount,
  policiesSummary,
  policyMeta,
  policyStatus,
  reviewedText,
  unreviewedCitedPolicy,
  type StaffPolicy,
} from "./staff-policies.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

// 2026-10-03 18:00 UTC is Oct 3 in Mountain Time.
const policies: StaffPolicy[] = [
  { documentId: A, title: "Emergency procedures", version: 2, reviewedAt: null },
  { documentId: B, title: "Grievances", version: 1, reviewedAt: "2026-10-03T18:00:00Z" },
];

describe("team member Policies tab wording (N6, as in the demo)", () => {
  it("each policy reads Needs review · vN or Reviewed <date> · vN", () => {
    assert.deepEqual(policyStatus(policies[0]!), { label: "Needs review · v2", tone: "warn" });
    assert.deepEqual(policyStatus(policies[1]!), { label: "Reviewed Oct 3 · v1", tone: "ok" });
  });

  it("uses the Mountain Time day of the review", () => {
    // 03:00 UTC on Oct 4 is still Oct 3 in Utah.
    assert.equal(
      policyStatus({ version: 1, reviewedAt: "2026-10-04T03:00:00Z" }).label,
      "Reviewed Oct 3 · v1",
    );
  });

  it("counts and sums up what still needs review", () => {
    assert.equal(needsReviewCount(policies), 1);
    assert.equal(policiesSummary(policies), "1 policy needs your review.");
    assert.equal(
      policiesSummary([...policies, { documentId: C, title: "X", version: 3, reviewedAt: null }]),
      "2 policies need your review.",
    );
    assert.equal(policiesSummary([policies[1]!]), "You're up to date on every policy.");
    assert.equal(policiesSummary([]), "No policies are meant for you yet.");
  });

  it("says when this version was reviewed, and what the button says", () => {
    assert.equal(reviewedText(1, "2026-10-03T18:00:00Z"), "You reviewed version 1 on Oct 3, 2026");
    assert.equal(markReviewedLabel("Grievances"), 'Mark "Grievances" as reviewed');
    assert.equal(policyMeta("agency", 2), "Agency policies · Version 2");
    assert.equal(policyMeta("procedures", 1), "Procedures and forms · Version 1");
  });
});

describe("Mark as reviewed inside an answer (N6)", () => {
  const cite = (kind: string, documentId: string | null) => ({ kind, documentId });

  it("offers the first cited policy meant for them that isn't reviewed", () => {
    const found = unreviewedCitedPolicy([cite("state_rule", null), cite("library", A)], policies);
    assert.equal(found?.documentId, A);
  });

  it("offers nothing for a reviewed policy, a state rule, a client fact or a document not meant for them", () => {
    assert.equal(unreviewedCitedPolicy([cite("library", B)], policies), null);
    assert.equal(unreviewedCitedPolicy([cite("state_rule", null)], policies), null);
    assert.equal(unreviewedCitedPolicy([cite("client_plan", null)], policies), null);
    // A reference document (not in their Policies list) never shows the button.
    assert.equal(unreviewedCitedPolicy([cite("library", C)], policies), null);
  });
});
