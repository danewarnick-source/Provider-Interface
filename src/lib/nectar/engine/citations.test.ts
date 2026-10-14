import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkCitations, isNotFoundReply } from "./citations.ts";

const NOT_FOUND = "I couldn't find that in your agency's documents.";
const sent = new Set(["s1", "s2", "s3"]);

describe("checkCitations (Decision 8: PI checks every cited id)", () => {
  it("numbers valid citations in the order they are first used", () => {
    const out = checkCitations(
      "Call the nurse [S:s2]. Write it down [S:s1]. Again [S:s2].",
      sent,
      NOT_FOUND,
    );
    assert.deepEqual(out, {
      answer: "Call the nurse [1]. Write it down [2]. Again [1].",
      cited: ["s2", "s1"],
    });
  });

  it("strips ids that were not sent, with the space before them", () => {
    const out = checkCitations("Call the nurse [S:s1]. Call 911 [S:s9] [S:abc].", sent, NOT_FOUND);
    assert.deepEqual(out, { answer: "Call the nurse [1]. Call 911.", cited: ["s1"] });
  });

  it("keeps the valid ids of a mixed citation and reads the forms models use", () => {
    assert.equal(
      checkCitations("A [S:s1, s7, S:s3]. B [S: S2]. C [s3].", sent, NOT_FOUND)?.answer,
      "A [1][2]. B [3]. C [2].",
    );
  });

  it("returns null when no valid citation remains", () => {
    assert.equal(checkCitations("Call 911 right away [S:s9].", sent, NOT_FOUND), null);
    assert.equal(checkCitations("An answer with no citation at all.", sent, NOT_FOUND), null);
    assert.equal(checkCitations("", sent, NOT_FOUND), null);
  });

  it("treats a cited 'couldn't find' reply as not found", () => {
    assert.equal(checkCitations(`${NOT_FOUND} [S:s1]`, sent, NOT_FOUND), null);
    assert.equal(
      isNotFoundReply("I couldn’t find that in your agency’s documents", NOT_FOUND),
      true,
    );
    assert.equal(
      isNotFoundReply("I couldn't find the form, but the policy says X.", NOT_FOUND),
      false,
    );
  });
});
