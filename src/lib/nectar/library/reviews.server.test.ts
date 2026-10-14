import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./reviews.server.ts", import.meta.url), "utf8");

function body(name: string): string {
  const start = SRC.search(new RegExp(`(export )?(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} exists`);
  const next = SRC.slice(start + 1).search(/\n\/\*\*|\n(export )?(async )?function /);
  return SRC.slice(start, next < 0 ? undefined : start + 1 + next);
}

describe("reviews.server.ts (N3)", () => {
  it("Mark as reviewed checks the version is published and meant for the person before writing", () => {
    const mark = body("markReviewed");
    const plan = mark.indexOf("planReview(doc, userId, await loadReviews(db, [doc.id], userId))");
    const insert = mark.indexOf('.from("policy_signatures").insert(row)');
    assert.ok(plan > 0 && insert > plan);
    assert.match(
      mark,
      /if \(!plan\.ok\) throw new Error\(REVIEW_REFUSAL_MESSAGE\[plan\.reason\]\);/,
    );
  });

  it("is idempotent per version: an existing review, or the unique index refusing a second, returns the first", () => {
    const mark = body("markReviewed");
    assert.match(mark, /if \(plan\.already\) return result\(plan\.already\.signed_at, true\);/);
    assert.match(mark, /if \(isDuplicateReview\(error\)\) \{/);
  });

  it("writes the review row with a hash of the version's text and no typed signature", () => {
    const mark = body("markReviewed");
    assert.match(mark, /contentHash: await sha256Hex\(reviewHashInput\(doc\)\)/);
    assert.match(mark, /const row = reviewInsertRow\(\{/);
    assert.doesNotMatch(SRC, /typed_signature/);
  });

  it("a team member opens only a published document meant for them", () => {
    assert.match(
      body("readPolicyForMember"),
      /if \(!doc \|\| !isVisibleToMember\(doc, userId\)\) throw new Error\(NOT_FOUND\);/,
    );
  });

  it("a team member sees the same sections as the admin view and Nectar search (N4)", () => {
    const read = body("readPolicyForMember");
    assert.match(read, /raw_text, storage_path, storage_bucket, mime_type`\)/);
    assert.match(read, /sections: splitDocumentSections\(doc\.raw_text \?\? "", doc\.mime_type\)/);
  });

  it("the review matrix and records cover published policies and procedures", () => {
    assert.match(body("readReviewMatrix"), /currentRows\(db, orgId, \{ reviewable: true \}\)/);
    assert.match(body("readStaffRecord"), /currentRows\(db, orgId, \{ reviewable: true \}\)/);
    assert.match(
      body("readStaffRecord"),
      /if \(!person\) throw new Error\("Team member not found\."\);/,
    );
  });
});
