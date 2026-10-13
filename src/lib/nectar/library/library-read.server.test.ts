import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./library-read.server.ts", import.meta.url), "utf8");

describe("library-read.server.ts (N3)", () => {
  it("shows state rules in the State rules group from PI's table, published and current, read-only", () => {
    assert.match(SRC, /\.from\("state_rule_documents"\)/);
    assert.match(SRC, /\.is\("archived_at", null\)\s*\.not\("published_at", "is", null\)/);
    assert.match(SRC, /g\.group === "state" \? \(stateRules\.data \?\? \[\]\)\.map\(stateRow\)/);
    assert.match(SRC, /note: STATE_RULES_NOTE/);
  });

  it("counts reviews only for published policies and procedures (N of M = the people it's for)", () => {
    assert.match(SRC, /r\.library_status === "published" && isReviewable\(r\.library_group\)/);
    assert.match(
      SRC,
      /reviewed: reviewable\.has\(r\) \? reviewCounts\(r, memberIds, reviews\) : null/,
    );
  });

  it("the document view shows its versions, sections, and each person's review of this version", () => {
    assert.match(SRC, /\.or\(`id\.eq\.\$\{root\},parent_document_id\.eq\.\$\{root\}`\)/);
    assert.match(SRC, /sections: splitSections\(text \?\? ""\)/);
    assert.match(SRC, /review: reviewCell\(doc, m\.userId, reviews\)/);
    assert.match(SRC, /audienceWarning: audienceWarning\(doc\)/);
  });

  it("required policies use the slot table, the agency's answers and today's date", () => {
    assert.match(SRC, /requiredSlotStatus\(slots, docs\.data \?\? \[\], toggles, today\)/);
    assert.ok(SRC.split("\n").length <= 300);
  });
});
