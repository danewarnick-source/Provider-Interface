import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { headingOf, isTitleLike, splitInlineHeadings } from "./section-headings.ts";

describe("isTitleLike", () => {
  it("accepts titles with small words, quotes and numbers", () => {
    assert.ok(isTitleLike("Transitions to or from the Utah State Developmental Center (“USDC”)"));
    assert.ok(isTitleLike("Person’s Discharge Procedure"));
    assert.ok(isTitleLike("DSPD Worksheet"));
  });

  it("rejects sentences and empty text", () => {
    assert.equal(isTitleLike("Staff must finish training"), false);
    assert.equal(isTitleLike(""), false);
  });
});

describe("headingOf", () => {
  const h = (line: string, prev?: string, next = "Text.") => headingOf(line, prev, next, false);

  it("reads Markdown, numbered, Article and capitals headings with their level", () => {
    assert.deepEqual(h("## **Purpose**"), { text: "Purpose", level: 2, numbered: false });
    assert.deepEqual(h("4.2.1 Weekly Checks:"), {
      text: "4.2.1 Weekly Checks",
      level: 3,
      numbered: true,
    });
    assert.deepEqual(h("Article 3 BEHAVIOR CONSULTATION I"), {
      text: "Article 3 BEHAVIOR CONSULTATION I",
      level: 1,
      numbered: false,
    });
    assert.deepEqual(h("1. PURPOSE"), { text: "1. PURPOSE", level: 1, numbered: false });
  });

  it("needs a Title Case line to stand on its own before a new sentence", () => {
    assert.deepEqual(h("Staff Grievances", "Ends here."), {
      text: "Staff Grievances",
      level: 2,
      numbered: false,
    });
    assert.equal(h("Staff Grievances", "and the team"), null, "middle of a sentence");
    assert.equal(h("Staff Grievances", "Ends here.", "continues in lowercase"), null);
    assert.equal(
      headingOf("Staff Grievances", "Ends here.", undefined, false),
      null,
      "nothing after it",
    );
    assert.equal(h("- Call Your Supervisor", ""), null, "a bullet");
    assert.equal(h("Call 911 first.", ""), null, "a sentence");
  });
});

describe("splitInlineHeadings", () => {
  it("puts inline numbered headings and the chapter title before them on their own lines", () => {
    const state = { last: null };
    const line =
      "Intro ends. Article 2 GENERAL LIMITATIONS 2.1 General Limitations. Text here. 2.2 Billing. More text.";
    assert.deepEqual(splitInlineHeadings(line, state), [
      "Intro ends.",
      "",
      "Article 2 GENERAL LIMITATIONS",
      "",
      "2.1 General Limitations.",
      "Text here.",
      "",
      "2.2 Billing.",
      "More text.",
    ]);
    assert.deepEqual(state.last, [2, 2]);
  });

  it("leaves cross-references and earlier numbers in the text", () => {
    const state = { last: [3, 1] };
    const line =
      "As described in 1.12 Electronic Visit Verification. Then 3.1 General Description. Done.";
    assert.deepEqual(splitInlineHeadings(line, state), [line]);
  });
});
