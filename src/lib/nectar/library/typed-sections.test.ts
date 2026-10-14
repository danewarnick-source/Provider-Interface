import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTypedHeading,
  isTypedText,
  splitDocumentSections,
  splitTypedSections,
} from "./typed-sections.ts";

const heads = (text: string) => splitTypedSections(text).map((s) => [s.heading, s.body]);

describe("typed-sections.ts (N4)", () => {
  it("a heading on its own line, blank line between sections, gives one section each", () => {
    assert.deepEqual(
      heads(
        "Purpose\nWhat this policy covers.\n\nWhat team members do\nCall the on-call supervisor.\nWrite it in your shift note.",
      ),
      [
        ["Purpose", "What this policy covers."],
        ["What team members do", "Call the on-call supervisor.\nWrite it in your shift note."],
      ],
    );
  });

  it("keeps sentence-case headings that the shape-based splitter misses", () => {
    const sections = splitTypedSections(
      "Signs someone may be getting sick\nWatch for changes in eating or sleep.\n\nWho notifies DSPD\nThe supervisor does.",
    );
    assert.deepEqual(
      sections.map((s) => s.heading),
      ["Signs someone may be getting sick", "Who notifies DSPD"],
    );
    assert.deepEqual(
      sections.map((s) => s.position),
      [0, 1],
    );
  });

  it("a heading alone in its block heads the next block; two in a row join", () => {
    assert.deepEqual(heads("Falls\n\nDo not lift them.\n\nPart A\n\nIntro\nText here."), [
      ["Falls", "Do not lift them."],
      ["Part A — Intro", "Text here."],
    ]);
  });

  it("a block with no heading continues the section before it", () => {
    assert.deepEqual(heads("Leaving a shift\nWait for relief.\n\nIf relief is late, call."), [
      ["Leaving a shift", "Wait for relief.\n\nIf relief is late, call."],
    ]);
    assert.deepEqual(heads("Just one sentence of text."), [[null, "Just one sentence of text."]]);
  });

  it("sentences, list items and wrapped lines are not headings", () => {
    assert.equal(isTypedHeading("Call 911 first."), false);
    assert.equal(isTypedHeading("- bring your badge"), false);
    assert.equal(isTypedHeading("staff must wait"), false);
    assert.equal(isTypedHeading("The agency will give each person", "a copy of the plan."), false);
    assert.equal(
      isTypedHeading("One two three four five six seven eight nine ten eleven twelve thirteen"),
      false,
    );
    assert.equal(isTypedHeading("§1.18(4) Emergencies:"), true);
    assert.equal(isTypedHeading("4.2 Staff training"), true);
  });

  it("cuts a long section into chunks under the same heading", () => {
    const body = Array.from({ length: 80 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const sections = splitTypedSections(`Long part\n${body}\n\n${body}`);
    assert.ok(sections.length > 1);
    assert.ok(sections.every((s) => s.heading === "Long part"));
  });

  it("uses the typed blocks only for plain text without Markdown headings", () => {
    assert.equal(isTypedText("text/plain"), true);
    assert.equal(isTypedText("text/markdown; charset=utf-8"), true);
    assert.equal(isTypedText("application/pdf"), false);
    assert.equal(isTypedText(null), false);
    const typed = "What team members do\nCall the supervisor.";
    assert.equal(splitDocumentSections(typed, "text/plain")[0]!.heading, "What team members do");
    assert.equal(splitDocumentSections(typed, "application/pdf")[0]!.heading, null);
    const md = "# Purpose\nWhy.\n\n## What team members do\nCall.";
    assert.deepEqual(
      splitDocumentSections(md, "text/plain").map((s) => s.heading),
      ["Purpose", "What team members do"],
    );
    assert.deepEqual(splitDocumentSections("", "text/plain"), []);
  });
});
