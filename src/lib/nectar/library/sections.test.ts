import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHUNK_TARGET_CHARS, MAX_SECTION_CHARS, chunkText, splitSections } from "./sections.ts";

const headings = (text: string) => splitSections(text).map((s) => s.heading);

const PARAGRAPH = (i: number) =>
  `Paragraph ${i} explains how team members keep clients safe. It adds the detail a reader needs. It ends with a short summary.`;

describe("splitSections: headings", () => {
  it("splits on Markdown # lines and keeps a chapter title in front of the deeper headings", () => {
    const text =
      "# Grievance Policy\n\n## Purpose\nHow concerns are raised.\n\n## Procedure\nTell your supervisor.\n\n# Appendix\nForms.";
    assert.deepEqual(splitSections(text), [
      { heading: "Grievance Policy — Purpose", body: "How concerns are raised.", position: 0 },
      { heading: "Grievance Policy — Procedure", body: "Tell your supervisor.", position: 1 },
      { heading: "Appendix", body: "Forms.", position: 2 },
    ]);
  });

  it("splits on numbered headings like 4.2, with or without a period, and on a heading followed by its first sentence", () => {
    const text =
      "4.1 Staff Training\nAll staff complete CPR within 30 days.\n4.2 Supervision. Supervisors check notes weekly.\n4.2.1 Weekly Checks\nEvery Friday.";
    assert.deepEqual(headings(text), [
      "4.1 Staff Training",
      "4.2 Supervision",
      "4.2.1 Weekly Checks",
    ]);
    assert.equal(splitSections(text)[1]!.body, "Supervisors check notes weekly.");
  });

  it("treats a numbered sentence or a cross-reference as text, not a heading", () => {
    const text =
      "4.1 Staff Training\n4.2 Staff must finish training before working alone.\nSee 4.1 Staff Training. It has the schedule.";
    const sections = splitSections(text);
    assert.deepEqual(
      sections.map((s) => s.heading),
      ["4.1 Staff Training"],
    );
    assert.match(sections[0]!.body, /^4\.2 Staff must finish/);
    assert.match(sections[0]!.body, /See 4\.1 Staff Training\. It has the schedule\./);
  });

  it("splits on a Title Case or capitals line on its own, but not on a wrapped sentence", () => {
    const text =
      "Intro text ends here.\nStaff Grievances\nA team member may file within 10 days.\nEMERGENCY PROCEDURES\nCall 911 first.\nThe team must document each visit.\nPerson Centered Support Plan\nmeetings happen every year.";
    assert.deepEqual(headings(text), [null, "Staff Grievances", "EMERGENCY PROCEDURES"]);
    assert.match(
      splitSections(text)[2]!.body,
      /Person Centered Support Plan\nmeetings happen every year\./,
    );
  });

  it("keeps table-of-contents lines out of later headings", () => {
    const text =
      "TABLE OF CONTENTS\n1.1 Purpose 3\n1.2 Scope 4\n\n1.1 Purpose\nCovers grievances.\n1.2 Scope\nApplies to all team members.";
    assert.deepEqual(headings(text), ["1.1 Purpose", "1.2 Scope"]);
  });

  it("drops repeating page headers and footers", () => {
    const text =
      "Emergency Procedures\nCall 911.\nPage 1 of 3\nCall the supervisor.\nPage 2 of 3\nWrite a report.\nPage 3 of 3";
    assert.deepEqual(splitSections(text), [
      {
        heading: "Emergency Procedures",
        body: "Call 911.\nCall the supervisor.\nWrite a report.",
        position: 0,
      },
    ]);
  });
});

describe("splitSections: PDF text stored with no line breaks (the old Scope of Work)", () => {
  const sow =
    "(L) residential services (RHS, HHS, or PPS) when a Person changes Contractors. " +
    "Article 3 BEHAVIOR CONSULTATION I - DHHS SERVICE CODE: BC1 3.1 General Description. " +
    "BC1 provides support to Persons with mild behavior problems. 3.2 Direct Service Requirements. " +
    "The Contractor shall serve Persons as described in 1.12 Electronic Visit Verification. Effective 7/1/26 25 " +
    "3.3 Functional Behavior Assessment (“FBA”). The Contractor shall complete an FBA. " +
    "3.1 General Description. A repeated earlier number is a reference, not a heading.";

  it("finds the numbered sections inline, in order, under their chapter title", () => {
    const sections = splitSections(sow);
    assert.deepEqual(
      sections.map((s) => s.heading),
      [
        null,
        "Article 3 BEHAVIOR CONSULTATION I - DHHS SERVICE CODE: BC1 — 3.1 General Description",
        "Article 3 BEHAVIOR CONSULTATION I - DHHS SERVICE CODE: BC1 — 3.2 Direct Service Requirements",
        "Article 3 BEHAVIOR CONSULTATION I - DHHS SERVICE CODE: BC1 — 3.3 Functional Behavior Assessment (“FBA”)",
      ],
    );
    assert.equal(sections[1]!.body, "BC1 provides support to Persons with mild behavior problems.");
    assert.match(sections[2]!.body, /described in 1\.12 Electronic Visit Verification\./);
    assert.match(sections[3]!.body, /3\.1 General Description\. A repeated earlier number/);
  });
});

describe("splitSections: chunks", () => {
  it("falls back to ~1,200-character chunks on paragraph breaks when there are no headings", () => {
    const text = Array.from({ length: 30 }, (_, i) => PARAGRAPH(i + 1)).join("\n\n");
    const sections = splitSections(text);
    assert.ok(sections.length >= 3);
    for (const s of sections) {
      assert.equal(s.heading, null);
      assert.ok(s.body.length <= CHUNK_TARGET_CHARS, `chunk of ${s.body.length}`);
      assert.match(s.body, /^Paragraph \d+ explains/);
    }
    assert.deepEqual(
      sections.map((s) => s.position),
      sections.map((_, i) => i),
    );
    const all = sections.map((s) => s.body).join("\n\n");
    assert.equal(all, text);
  });

  it("cuts a long section into parts that keep its heading", () => {
    const text = `## Training\n${Array.from({ length: 25 }, (_, i) => PARAGRAPH(i + 1)).join("\n\n")}`;
    const sections = splitSections(text);
    assert.ok(sections.length > 1);
    assert.ok(
      sections.every((s) => s.heading === "Training" && s.body.length <= MAX_SECTION_CHARS),
    );
  });

  it("cuts text with no paragraph breaks at sentence ends", () => {
    const text = Array.from({ length: 40 }, (_, i) => PARAGRAPH(i + 1)).join(" ");
    const chunks = chunkText(text);
    assert.ok(chunks.length > 1);
    for (const c of chunks) assert.match(c, /\.$/);
  });

  it("keeps a short section whole and returns nothing for empty text", () => {
    assert.deepEqual(chunkText("Short."), ["Short."]);
    assert.deepEqual(splitSections(""), []);
    assert.deepEqual(splitSections("  \n\n "), []);
  });
});
