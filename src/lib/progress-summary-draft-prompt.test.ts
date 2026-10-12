import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyEditorState, type SummaryEvidence } from "./progress-summary-doc.ts";
import { planDraft } from "./progress-summary-draft-prompt.ts";

const ev = (over: Partial<SummaryEvidence>): SummaryEvidence => ({
  id: "e",
  kind: "daily_log",
  date: "2026-10-03",
  who: "Sam Lee",
  text: "Laundry with 3 prompts.",
  goalIds: ["ils"],
  labels: [],
  code: null,
  ...over,
});

const plan = () =>
  planDraft({
    editor: { ...emptyEditorState(), goals: { ils: "On 10/3 Joby needed 3 prompts." } },
    goals: [{ id: "ils", goal: "Independent living skills", job_codes: ["SLN"], supports: [] }],
    evidence: [
      ev({ id: "a" }),
      ev({ id: "b", date: "2026-11-20", text: "Laundry with 1 prompt." }),
      ev({ id: "i", kind: "incident", who: "#IR-7", text: "Fall: Slipped.", goalIds: [] }),
    ],
    fields: ["goal:ils", "general", "incidentNotes"],
    person: { firstName: "Joby", lastName: "Austin" },
    services: ["SLN"],
    cadence: "quarterly",
  });

describe("planDraft", () => {
  it("asks for a summary of the period; records go in without staff names or report numbers", () => {
    const p = plan();
    assert.deepEqual(p.boxes, ["goal:ils", "incidentNotes"], "general has no text and no records");
    assert.equal(p.skipped, 1);
    assert.match(p.system, /WRITE A SUMMARY OF THE WHOLE PERIOD, NOT A LOG/);
    assert.match(p.user, /\[2026-10-03\] Daily log: Laundry with 3 prompts\./);
    assert.doesNotMatch(p.user, /Sam Lee|IR-7/);
    assert.deepEqual(p.incidentIds, ["i"]);
  });
  it("a draft that drops dates is used; one with an invented number is not", () => {
    const ok = plan().check(
      JSON.stringify({
        goals: { ils: "Joby went from needing three prompts for laundry to needing one." },
        incidentNotes: "Joby slipped once and was not hurt.",
      }),
    );
    assert.deepEqual(
      ok.drafts.map((d) => [d.field, d.dropped]),
      [
        ["goal:ils", undefined],
        ["incidentNotes", undefined],
      ],
    );
    const bad = plan().check(JSON.stringify({ goals: { ils: "Joby did laundry 14 times." } }));
    assert.deepEqual(bad.drafts, []);
    assert.deepEqual(bad.failed, [
      { field: "goal:ils", reason: "unsupported", facts: ["14"] },
      { field: "incidentNotes", reason: "unchanged", facts: [] },
    ]);
  });
});
