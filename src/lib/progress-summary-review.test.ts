import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyEditorState, type SummaryEditorState } from "./progress-summary-doc.ts";
import {
  acceptSuggestion,
  buildSuggestions,
  canDismiss,
  cleanNectarFindings,
  datesOutsidePeriod,
  dedupeFields,
  dismissFinding,
  droppedFacts,
  emptyReviewState,
  finalizeBlockers,
  findDates,
  findingNeedsReason,
  keepMine,
  openFindings,
  readReviewState,
  summaryChecks,
  unsupportedFacts,
  type FieldKey,
  type ReviewContext,
  type SummaryReviewState,
} from "./progress-summary-review.ts";

const joby: ReviewContext = {
  periodStart: "2026-10-01",
  periodEnd: "2026-12-31",
  serviceCodes: ["SLN"],
  summaryKind: "narrative",
  includeGoalProgress: true,
  goals: [
    { id: "g1", goal: "Independent Living Skills" },
    { id: "g2", goal: "her talents" },
  ],
};

const editorWith = (patch: Partial<SummaryEditorState>): SummaryEditorState => ({
  ...emptyEditorState(),
  ...patch,
});

const JOBY_GENERAL =
  "Joby moved into her new apartment. On 8/5 she started cooking with staff. On 9/16 she painted at the art center and on 9/21 she sold a painting. Plan for next quarter: keep cooking twice a week.";

describe("findDates", () => {
  it("reads numeric, ISO and written dates; skips fractions", () => {
    const raws = findDates(
      "On 8/5, 2026-10-03, Oct 4, 5th of November, December 2026 and in August; 3/4 of the time; 24/7.",
    ).map((d) => d.raw);
    assert.deepEqual(raws, [
      "8/5",
      "2026-10-03",
      "Oct 4",
      "5th of November",
      "December 2026",
      "August",
    ]);
  });
  it("May and March alone are words, not dates", () => {
    assert.deepEqual(findDates("She may march on."), []);
  });
});

describe("summaryChecks — the Joby example (2026-Q4 SLN)", () => {
  const editor = editorWith({ general: JOBY_GENERAL });
  const checks = summaryChecks(joby, editor);
  it("flags 8/5, 9/16 and 9/21 as outside Oct 1 – Dec 31, 2026", () => {
    const out = checks.filter((f) => f.kind === "out_of_period");
    assert.deepEqual(
      out.map((f) => f.quote),
      ["8/5", "9/16", "9/21"],
    );
    assert.ok(out.every((f) => f.field === "general" && !f.needsReason));
    assert.match(out[0].message, /outside this period \(Oct 1 – Dec 31, 2026\)/);
  });
  it("flags each goal with no progress, needing a reason to keep", () => {
    const missing = checks.filter((f) => f.kind === "missing_progress");
    assert.deepEqual(
      missing.map((f) => f.field),
      ["goal:g1", "goal:g2"],
    );
    assert.ok(missing.every((f) => f.needsReason && f.cite === "DHHS91172 §1.25(5)"));
  });
  it("in-period dates and filled goals are not flagged", () => {
    const ok = summaryChecks(
      joby,
      editorWith({
        general: "On 10/3 and Nov 12 she cooked.",
        goals: { g1: "Cooked.", g2: "Painted." },
      }),
    );
    assert.deepEqual(ok, []);
  });
  it("empty general notes are missing required content", () => {
    const f = summaryChecks(joby, editorWith({ goals: { g1: "a", g2: "b" } }));
    assert.equal(f.length, 1);
    assert.equal(f[0].kind, "missing_required");
    assert.match(f[0].cite ?? "", /§1\.25\(4\)/);
  });
  it("SJD: no USOR mention is flagged; excluded codes skip goals", () => {
    const sjd = summaryChecks(
      { ...joby, serviceCodes: ["SJD"] },
      editorWith({ general: "Worked on applications weekly.", goals: { g1: "a", g2: "b" } }),
    );
    assert.deepEqual(
      sjd.map((f) => f.key),
      ["check:missing_required:usor_contact"],
    );
    const els = summaryChecks({ ...joby, serviceCodes: ["ELS"] }, editorWith({ general: "x" }));
    assert.deepEqual(els, []);
  });
  it("a manual incident dated outside the period is flagged", () => {
    const f = summaryChecks(
      joby,
      editorWith({
        general: "x",
        goals: { g1: "a", g2: "b" },
        incidents: [{ id: "m1", date: "2026-09-30", what: "Fell", followUp: "" }],
      }),
    );
    assert.deepEqual(
      f.map((x) => x.field),
      ["incident:m1"],
    );
  });
  it("financial statements are not checked", () => {
    assert.deepEqual(
      summaryChecks({ ...joby, summaryKind: "financial_statement" }, editorWith({})),
      [],
    );
  });
  it("datesOutsidePeriod handles a month on its own", () => {
    assert.deepEqual(
      datesOutsidePeriod("In August and in October", "2026-10-01", "2026-12-31").map((d) => d.raw),
      ["August"],
    );
  });
});

describe("rewrite validation", () => {
  it("a date or number in neither the typed text nor the records is unsupported", () => {
    assert.deepEqual(
      unsupportedFacts("On 10/3 she cooked 3 meals.", ["She cooked three meals on Oct 3."]),
      [],
    );
    assert.deepEqual(unsupportedFacts("On 10/9 she cooked 4 meals.", ["Cooked 3 meals on 10/3."]), [
      "10/9",
      "4",
    ]);
  });
  it("droppedFacts lists the typed dates and numbers that are gone", () => {
    assert.deepEqual(
      droppedFacts("On 8/5 she cooked 3 times.", ["On August 5 she cooked three times."]),
      [],
    );
    assert.deepEqual(droppedFacts("On 8/5 she cooked 3 times.", ["She cooked."]), ["8/5", "3"]);
  });
  it("dedupeFields drops repeated sentences within and across fields", () => {
    const out = dedupeFields([
      ["goal:g1", "She cooked pasta. She cooked pasta!"],
      ["general", "She  cooked pasta. She painted."],
    ]);
    assert.equal(out.get("goal:g1"), "She cooked pasta.");
    assert.equal(out.get("general"), "She painted.");
  });
  it("buildSuggestions: drops made-up facts, flags dropped typed facts, links moved text", () => {
    const current = new Map<FieldKey, string>([
      ["goal:g1", ""],
      ["goal:g2", ""],
      ["general", JOBY_GENERAL],
      ["incidentNotes", ""],
    ]);
    const res = buildSuggestions({
      current,
      proposed: new Map<FieldKey, string>([
        ["goal:g1", "On 8/5 Joby started cooking with staff. Plan: keep cooking twice a week."],
        ["goal:g2", "On 9/16 Joby painted at the art center and on 9/21 she sold a painting."],
        ["general", "Joby moved into her new apartment."],
        ["incidentNotes", "Joby fell on 11/2."],
      ]),
      records: [],
      order: ["goal:g1", "goal:g2", "general", "incidentNotes"],
    });
    assert.deepEqual(res.rejected, [{ field: "incidentNotes", facts: ["11/2"] }]);
    const general = res.suggestions.find((s) => s.field === "general");
    assert.deepEqual(general?.drops, []);
    assert.deepEqual(general?.linked.sort(), ["goal:g1", "goal:g2"]);

    const lossy = buildSuggestions({
      current,
      proposed: new Map<FieldKey, string>([["general", "Joby moved into her new apartment."]]),
      records: [],
      order: ["goal:g1", "goal:g2", "general", "incidentNotes"],
    });
    assert.deepEqual(lossy.suggestions[0].drops, ["8/5", "9/16", "9/21"]);
  });
  it("a rewrite equal to the field is not offered", () => {
    const res = buildSuggestions({
      current: new Map<FieldKey, string>([["general", "Same."]]),
      proposed: new Map<FieldKey, string>([["general", " Same. "]]),
      records: [],
      order: ["general"],
    });
    assert.deepEqual(res.suggestions, []);
  });
});

describe("Nectar findings", () => {
  const fields = new Map<FieldKey, string>([
    ["general", JOBY_GENERAL],
    ["goal:g1", ""],
  ]);
  it("keeps valid findings, drops unknown fields/kinds and dates the checks own", () => {
    const out = cleanNectarFindings(
      [
        {
          field: "general",
          kind: "misplaced",
          quote: "she started cooking with staff",
          message: "About cooking.",
          moveTo: "g1",
        },
        { field: "general", kind: "vague", quote: "not in the text", message: "Vague." },
        { field: "nope", kind: "vague", message: "x" },
        { field: "general", kind: "made_up", message: "x" },
        { field: "general", kind: "out_of_period", quote: "On 8/5", message: "Old" },
        {
          field: "general",
          kind: "missing_required",
          requirement: "status_response",
          message: "No response to services.",
        },
      ],
      fields,
      new Set(["g1"]),
      new Map([["status_response", "DHHS91172 §1.25(4)"]]),
    );
    assert.equal(out.length, 3);
    assert.equal(out[0].moveTo, "g1");
    assert.equal(out[1].quote, undefined, "a quote not in the field is dropped");
    assert.equal(out[2].cite, "DHHS91172 §1.25(4)");
  });
});

describe("finalize gating", () => {
  const editor = editorWith({ general: JOBY_GENERAL, goals: { g1: "Cooked.", g2: "Painted." } });
  const review: SummaryReviewState = {
    ...emptyReviewState(),
    findings: cleanNectarFindings(
      [
        {
          field: "general",
          kind: "misplaced",
          quote: "she started cooking with staff",
          message: "Move it.",
          moveTo: "g1",
        },
      ],
      new Map<FieldKey, string>([["general", JOBY_GENERAL]]),
      new Set(["g1", "g2"]),
    ),
  };
  const who = { by: "u1", byName: "Ann Admin", at: "2026-10-08T00:00:00Z" };
  it("checks and live Nectar findings block until fixed or kept", () => {
    const checks = summaryChecks(joby, editor);
    assert.equal(openFindings(checks, review, editor).length, 4);
    let r = review;
    for (const f of checks) r = dismissFinding(r, f, who, null);
    assert.equal(openFindings(checks, r, editor).length, 1);
    const fixed = editorWith({ ...editor, general: "Joby moved into her new apartment." });
    assert.equal(
      openFindings(summaryChecks(joby, fixed), r, fixed).length,
      0,
      "quote gone = fixed",
    );
    assert.equal(r.dismissals[checks[0].key].byName, "Ann Admin");
  });
  it("finalizeBlockers = the checks plus the review; needsReason readable from the key", () => {
    assert.equal(finalizeBlockers(joby, editor, review).length, 4);
    const checks = summaryChecks(joby, editorWith({}));
    assert.ok(checks.every((f) => findingNeedsReason(f.key) === f.needsReason));
    assert.equal(findingNeedsReason("nectar:missing_required:general:x"), false);
  });
  it("missing required content needs a reason to keep", () => {
    const f = summaryChecks(joby, editorWith({ general: "x" }))[0];
    assert.equal(canDismiss(f, ""), false);
    assert.throws(() => dismissFinding(emptyReviewState(), f, who, "no"));
    const r = dismissFinding(emptyReviewState(), f, who, "Goal starts next quarter");
    assert.equal(r.dismissals[f.key].reason, "Goal starts next quarter");
  });
  it("accepting a suggestion takes its linked fields, marks Nectar text, activates its findings", () => {
    const base: SummaryReviewState = {
      ...emptyReviewState(),
      suggestions: [
        { field: "general", text: "Moved in.", drops: [], linked: ["goal:g1"] },
        { field: "goal:g1", text: "Cooked on 8/5.", drops: [], linked: [] },
        { field: "goal:g2", text: "Lossy.", drops: ["9/16"], linked: [] },
      ],
      findings: [
        {
          key: "k",
          field: "goal:g1",
          kind: "vague",
          message: "m",
          source: "nectar",
          needsReason: false,
          onSuggestion: true,
        },
      ],
    };
    const ed = editorWith({ general: "Moved in. Cooked on 8/5." });
    assert.equal(openFindings([], base, ed).length, 0);
    const res = acceptSuggestion(ed, base, "general");
    assert.deepEqual(res.accepted, ["general", "goal:g1"]);
    assert.equal(res.editor.goals.g1, "Cooked on 8/5.");
    assert.equal(res.editor.nectar.general, "Moved in.");
    assert.equal(openFindings([], res.review, res.editor).length, 1);
    assert.throws(() => acceptSuggestion(ed, base, "goal:g2"), /drops something you wrote/);
    const kept = keepMine(base, "goal:g1");
    assert.equal(kept.findings.length, 0);
    assert.equal(kept.suggestions.length, 2);
  });
  it("readReviewState normalizes saved state", () => {
    assert.deepEqual(readReviewState(null), emptyReviewState());
    const r = readReviewState({
      mode: "draft",
      findings: [{ key: 1 }],
      dismissals: { a: { by: "u", at: "t" } },
    });
    assert.equal(r.mode, "draft");
    assert.equal(r.findings.length, 0);
    assert.deepEqual(r.dismissals.a, { by: "u", at: "t", byName: null, reason: null });
  });
});
