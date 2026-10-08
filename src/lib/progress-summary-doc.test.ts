import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DRAFT_MARK,
  NO_PROGRESS_TEXT,
  buildSummaryDoc,
  editorFromLegacyText,
  emptyEditorState,
  evidenceFromRows,
  evidenceLine,
  groupEvidence,
  hasNectarText,
  manualIncidentLine,
  oneLine,
  readEditorState,
  summaryDocText,
  summaryFileName,
  utahDay,
  type SummaryEvidence,
} from "./progress-summary-doc.ts";

const goals = [
  {
    id: "g1",
    goal: "Pat will cook a meal.",
    job_codes: ["SLN"],
    supports: [{ support: "Meal prep coaching", details: "Twice a week", codes: ["SLN"] }],
  },
  { id: "g2", goal: "Pat will ride the bus.", job_codes: ["SLN"], supports: [] },
];

const ev = (over: Partial<SummaryEvidence>): SummaryEvidence => ({
  id: "e",
  kind: "daily_log",
  date: "2026-10-03",
  who: "Sam Lee",
  text: "Cooked pasta with prompts.",
  goalIds: [],
  labels: [],
  code: null,
  ...over,
});

describe("hasNectarText", () => {
  it("true while a field still holds the Nectar suggestion it took", () => {
    const e = emptyEditorState();
    assert.equal(hasNectarText(e), false);
    assert.equal(hasNectarText({ ...e, general: "N", nectar: { ...e.nectar, general: "N" } }), true);
    assert.equal(hasNectarText({ ...e, general: "edited", nectar: { ...e.nectar, general: "N" } }), false);
    assert.equal(
      hasNectarText({ ...e, goals: { g1: "N" }, nectar: { ...e.nectar, goals: { g1: "N" } } }),
      true,
    );
  });
});

describe("evidence", () => {
  it("groups notes under the goals they addressed (id or label), the rest under General, incidents apart", () => {
    const list = [
      ev({ id: "a", goalIds: ["g1"] }),
      ev({ id: "b", labels: ["Pat will ride the bus. — Bus training"] }),
      ev({ id: "c", goalIds: ["g1", "g2"] }),
      ev({ id: "d", labels: ["General baseline monitoring & safety oversight"] }),
      ev({ id: "i", kind: "incident" }),
    ];
    const g = groupEvidence(goals, list);
    assert.deepEqual(
      g.byGoal.g1.map((e) => e.id),
      ["a", "c"],
    );
    assert.deepEqual(
      g.byGoal.g2.map((e) => e.id),
      ["b", "c"],
    );
    assert.deepEqual(
      g.general.map((e) => e.id),
      ["d"],
    );
    assert.deepEqual(
      g.incidents.map((e) => e.id),
      ["i"],
    );
  });

  it("maps rows to evidence, oldest first, with names, Utah dates and empty notes dropped", () => {
    const out = evidenceFromRows({
      logs: [
        {
          id: "l1",
          log_date: "2026-10-05",
          narrative: "Log",
          user_id: "u1",
          goal_ids: ["g1"],
          pcsp_goals_addressed: null,
        },
      ],
      shiftNotes: [
        {
          id: "s1",
          clock_in_timestamp: "2026-10-02T02:00:00Z",
          shift_note_text: "Note",
          staff_id: "u2",
          service_type_code: "sln",
          goal_ids: null,
          goals_completed: ["Pat will cook a meal. — Meal prep coaching"],
        },
        {
          id: "s2",
          clock_in_timestamp: "2026-10-03T15:00:00Z",
          shift_note_text: "  ",
          staff_id: "u2",
          service_type_code: null,
          goal_ids: null,
          goals_completed: null,
        },
      ],
      reports: [
        {
          id: "r1",
          created_at: "2026-10-04T18:00:00Z",
          narrative: "Report",
          staff_id: null,
          service_code: "SLN",
        },
      ],
      incidents: [
        {
          id: "i1",
          report_number: "IR-7",
          incident_date: "2026-10-06",
          incident_types: ["Fall"],
          narrative_during: "Slipped.",
        },
      ],
      names: new Map([
        ["u1", "Sam Lee"],
        ["u2", "Ana Ruiz"],
      ]),
    });
    assert.deepEqual(
      out.map((e) => [e.id, e.kind, e.date, e.who, e.code]),
      [
        ["s1", "shift_note", "2026-10-01", "Ana Ruiz", "SLN"],
        ["r1", "shift_report", "2026-10-04", null, "SLN"],
        ["l1", "daily_log", "2026-10-05", "Sam Lee", null],
        ["i1", "incident", "2026-10-06", "#IR-7", null],
      ],
    );
    assert.equal(out[3].text, "Fall: Slipped.");
    assert.deepEqual(out[0].labels, ["Pat will cook a meal. — Meal prep coaching"]);
  });

  it("one-line excerpts and dated lines", () => {
    assert.equal(oneLine("a\n  b"), "a b");
    assert.equal(oneLine("x".repeat(200), 10), `${"x".repeat(9)}…`);
    assert.equal(evidenceLine(ev({})), "Oct 3, 2026 · Sam Lee · Cooked pasta with prompts.");
    assert.equal(
      evidenceLine(ev({ who: null, kind: "shift_note", text: "" })),
      "Oct 3, 2026 · Shift note · (no text)",
    );
    assert.equal(utahDay("2026-10-02T05:30:00Z"), "2026-10-01");
  });
});

describe("editor state", () => {
  it("reads saved state defensively", () => {
    assert.equal(readEditorState(null), null);
    assert.equal(readEditorState([]), null);
    const s = readEditorState({
      general: "G",
      goals: { g1: "x", bad: 3 },
      incidents: [{ what: "W" }, null],
      nectar: { goals: { g1: "x" } },
    });
    assert.deepEqual(s, {
      general: "G",
      goals: { g1: "x" },
      incidents: [{ id: "m1", date: "", what: "W", followUp: "" }],
      incidentNotes: "",
      nectar: { general: "", incidentNotes: "", goals: { g1: "x" } },
    });
  });

  it("reads older text drafts back into fields; unstructured text stays whole in general", () => {
    const legacy = [
      "PERSON: Pat",
      "",
      "GENERAL SUMMARY",
      "A steady quarter.",
      "",
      "GOAL PROGRESS",
      "Goal: Pat will cook a meal.",
      "Cooked pasta twice.",
      "",
      "Goal: Pat will ride the bus.",
      "Rode once.",
    ].join("\n");
    const s = editorFromLegacyText(legacy, goals);
    assert.equal(s.general, "A steady quarter.");
    assert.deepEqual(s.goals, { g1: "Cooked pasta twice.", g2: "Rode once." });
    assert.equal(editorFromLegacyText("Just prose.", goals).general, "Just prose.");
    assert.deepEqual(editorFromLegacyText(null, goals), emptyEditorState());
  });
});

describe("the document", () => {
  const summary = {
    period_kind: "quarterly",
    period_label: "2026-Q4",
    period_start: "2026-10-01",
    period_end: "2026-12-31",
    due_date: "2027-01-15",
    service_codes: ["SLN"],
    include_goal_progress: true,
    drafted_at: "2026-10-08T00:00:00Z",
    status: "draft",
    finalized_at: null,
    finalized_by_name: null,
  };
  const editor = {
    ...emptyEditorState(),
    general: "Overall steady.",
    goals: { g1: "Cooked twice." },
    incidents: [
      { id: "m1", date: "2026-10-09", what: "Fell in kitchen", followUp: "Nurse checked" },
      { id: "m2", date: "", what: "", followUp: "" },
    ],
  };
  const input = {
    provider: "Example Supports",
    clientName: "Pat Example",
    coordinator: null,
    summary,
    teamMembers: ["Sam Lee"],
    goals,
    evidence: [
      ev({ id: "a", goalIds: ["g1"] }),
      ev({ id: "b", date: "2026-10-04" }),
      ev({ id: "i", kind: "incident", who: "#IR-7", text: "Fall: Slipped." }),
    ],
    editor,
  };

  it("header, goals with supports, progress and evidence, general, incidents; draft mark until finalized", () => {
    const doc = buildSummaryDoc(input);
    assert.equal(doc.draftMark, DRAFT_MARK);
    assert.deepEqual(doc.facts.slice(0, 7), [
      ["Client", "Pat Example"],
      ["Service provider", "Example Supports"],
      ["Support coordinator", "Not on file"],
      ["Period", "Q4 2026 (Oct 1, 2026 – Dec 31, 2026)"],
      ["Services", "SLN"],
      ["Cadence", "Quarterly · due 15 days after quarter end · to Support Coordinator"],
      ["Due", "Jan 15, 2027"],
    ]);
    assert.deepEqual(doc.goals[0], {
      goal: "Pat will cook a meal.",
      supports: [{ support: "Meal prep coaching", details: "Twice a week" }],
      progress: "Cooked twice.",
      evidence: ["Oct 3, 2026 · Sam Lee · Cooked pasta with prompts."],
    });
    assert.deepEqual(doc.goals[1].evidence, []);
    assert.equal(doc.general.evidence.length, 1);
    assert.deepEqual(doc.incidents.records, ["Oct 3, 2026 · #IR-7 · Fall: Slipped."]);
    assert.equal(doc.incidents.manual.length, 1, "blank manual entries are left out");

    const final = buildSummaryDoc({
      ...input,
      summary: {
        ...summary,
        status: "finalized",
        finalized_at: "2026-10-10",
        finalized_by_name: "Dana",
      },
      aiReviewAttested: true,
      filingNote: "Send it.",
    });
    assert.equal(final.draftMark, null);
    assert.equal(final.signoff[0], "Finalized Oct 10, 2026 by Dana.");
    assert.equal(final.signoff.length, 3);
  });

  it("no goal progress for the codes: no goal blocks, all notes under General", () => {
    const doc = buildSummaryDoc({
      ...input,
      summary: { ...summary, include_goal_progress: false },
    });
    assert.equal(doc.goals.length, 0);
    assert.equal(doc.general.evidence.length, 2);
  });

  it("as text: goal blocks, blank progress gets the no-documentation line, incidents, notes", () => {
    const text = summaryDocText(buildSummaryDoc(input));
    assert.match(
      text,
      /^Example Supports\nPROGRESS SUMMARY\nNectar draft — review before finalizing\n/,
    );
    assert.match(
      text,
      /GOAL 1: Pat will cook a meal\.\nSupport: Meal prep coaching\nSupport details: Twice a week\nProgress \/ summary of services:\nCooked twice\.\nEvidence this period \(1\):\n- Oct 3, 2026/,
    );
    assert.match(
      text,
      /GOAL 2: Pat will ride the bus\.\nProgress \/ summary of services:\nNo documentation in this period supports progress on this goal\.\nEvidence this period \(0\):/,
    );
    assert.match(
      text,
      /INCIDENTS \(2\)\n- Oct 3, 2026 · #IR-7 · Fall: Slipped\.\n- Oct 9, 2026 · Fell in kitchen · Follow-up: Nurse checked/,
    );
    assert.match(text, /GENERAL NOTES\nOverall steady\.$/);
  });

  it("manual incident line and file name", () => {
    assert.equal(
      manualIncidentLine({ id: "x", date: "", what: "", followUp: "" }),
      "Date not given · (not described)",
    );
    assert.equal(
      summaryFileName("Joby Austin", "2026-Q4"),
      "progress-summary-joby-austin-2026-q4.pdf",
    );
    assert.equal(summaryFileName("Pat", "2026-10-FS"), "progress-summary-pat-2026-10.pdf");
  });
});
