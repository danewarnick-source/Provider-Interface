import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyEditorState, type SummaryEditorState } from "./progress-summary-doc.ts";
import {
  JOBY,
  JOBY_EDITOR,
  JOBY_ILS_GOAL,
  JOBY_TALENT_GOAL,
} from "./progress-summary-joby.fixture.ts";
import {
  applyDraft,
  blankGoals,
  buildDrafts,
  dedupeFields,
  dismissKey,
  draftFailureMessage,
  droppedFacts,
  emptyReviewState,
  findDates,
  goalCovered,
  goalsNeedingAreaCheck,
  pushUndo,
  readReviewState,
  saysNoIncidents,
  summaryReminders,
  undoDraft,
  unsupportedFacts,
  type BoxDraft,
  type FieldKey,
  type SummaryReviewState,
  type UndoStacks,
} from "./progress-summary-review.ts";

const editorWith = (patch: Partial<SummaryEditorState>): SummaryEditorState => ({
  ...emptyEditorState(),
  ...patch,
});
const empty = emptyReviewState();

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

describe("Joby Austin, SLN, 2026-Q4 (the fixed fixture)", () => {
  it("no date reminder of any kind: dates before the quarter are fine", () => {
    const rem = summaryReminders(JOBY, JOBY_EDITOR, empty);
    assert.deepEqual(rem, []);
    const all = summaryReminders(
      JOBY,
      editorWith({ ...JOBY_EDITOR, general: "On 8/5 and 9/16 and in September she did well." }),
      empty,
    );
    assert.ok(all.every((r) => !/8\/5|9\/16|September|period|outside/i.test(r.text)));
  });
  it("both goals are covered: painting, ukulele, laundry, meals and a budget are fine", () => {
    for (const g of JOBY.goals) {
      assert.equal(goalCovered(JOBY_EDITOR.goals[g.id], g, ["Joby"]), true, g.goal);
    }
    assert.deepEqual(goalsNeedingAreaCheck(JOBY, JOBY_EDITOR), []);
  });
  it("painting under the piano goal is fine; the person's name alone does not count as a match", () => {
    const talent = JOBY.goals[1];
    assert.equal(goalCovered("Joby painted a landscape.", talent, ["Joby"]), true);
    assert.equal(goalCovered("Joby went to the dentist.", talent, ["Joby"]), false);
    assert.equal(goalCovered("Joby went to the dentist.", talent), true, "name is a shared word without the ignore list");
  });
  it("shares a word or stem with the goal or its supports", () => {
    const g = { id: "x", goal: "Build friendships", supports: [{ support: "Join a book club" }] };
    assert.equal(goalCovered("She joined the club and made a friendship.", g), true);
    assert.equal(goalCovered("Cooked pasta.", g), false);
  });
  it("no off-goal, misplaced or vague reminders exist; only the two fixed goal kinds", () => {
    const blank = summaryReminders(JOBY, editorWith({ general: "x" }), empty);
    const kinds = new Set(blank.map((r) => r.kind));
    for (const k of kinds) assert.ok(["no_progress", "off_area"].includes(k));
    assert.ok(blank.every((r) => !/vague|list of tasks|tone|reads like/i.test(r.text)));
  });
  it("zero overlap only is put to Nectar", () => {
    const e = editorWith({ ...JOBY_EDITOR, goals: { ...JOBY_EDITOR.goals, talent: "Joby went to the dentist." } });
    assert.deepEqual(
      goalsNeedingAreaCheck(JOBY, e).map((g) => g.id),
      ["talent"],
    );
  });
});

describe("blank-goal confirm (Finalize never blocks)", () => {
  it("triggers only when a goal has no progress text", () => {
    assert.deepEqual(blankGoals(JOBY, JOBY_EDITOR), []);
    const one = blankGoals(JOBY, editorWith({ ...JOBY_EDITOR, goals: { ils: "Cooked and did laundry.", talent: "  " } }));
    assert.deepEqual(
      one.map((g) => g.goal),
      [JOBY_TALENT_GOAL],
    );
    assert.deepEqual(
      blankGoals(JOBY, emptyEditorState()).map((g) => g.goal),
      [JOBY_ILS_GOAL, JOBY_TALENT_GOAL],
    );
  });
  it("no goals asked for when goal progress is off or it is not a narrative", () => {
    assert.deepEqual(blankGoals({ ...JOBY, includeGoalProgress: false }, emptyEditorState()), []);
    assert.deepEqual(blankGoals({ ...JOBY, summaryKind: "financial_statement" }, emptyEditorState()), []);
  });
  it("finalize allowed with zero review: nothing in the saved review is required", () => {
    const review = readReviewState(undefined);
    assert.deepEqual(review, emptyReviewState());
    assert.deepEqual(summaryReminders(JOBY, JOBY_EDITOR, review), []);
  });
});

describe("reminders (fixed wording, never required)", () => {
  it("a goal with no progress: one fixed line per goal", () => {
    const rem = summaryReminders(JOBY, editorWith({ general: "Joby is happy. She went to a concert." }), empty);
    assert.deepEqual(
      rem.map((r) => r.text),
      [
        `No progress written for ${JOBY_ILS_GOAL} yet.`,
        `No progress written for ${JOBY_TALENT_GOAL} yet.`,
      ],
    );
  });
  it("general notes are optional: never a reminder, typed or blank", () => {
    for (const general of ["", "Services continued as planned."]) {
      const rem = summaryReminders(JOBY, editorWith({ goals: JOBY_EDITOR.goals, general }), empty);
      assert.deepEqual(rem, []);
    }
  });
  it("Nectar's 'no' on a goal shows a fixed reminder only while that text stands", () => {
    const e = editorWith({ ...JOBY_EDITOR, goals: { ...JOBY_EDITOR.goals, talent: "Joby went to the dentist." } });
    const review: SummaryReviewState = { ...empty, offArea: { talent: "Joby went to the dentist." } };
    const rem = summaryReminders(JOBY, e, review);
    assert.deepEqual(
      rem.map((r) => r.key),
      ["rem:off_area:talent"],
    );
    assert.deepEqual(summaryReminders(JOBY, e, empty), [], "no answer yet: nothing shown");
    const changed = editorWith({ ...e, goals: { ...e.goals, talent: "Joby painted." } });
    assert.deepEqual(summaryReminders(JOBY, changed, review), []);
  });
  it("financial statements get none", () => {
    assert.deepEqual(summaryReminders({ ...JOBY, summaryKind: "financial_statement" }, emptyEditorState(), empty), []);
  });
  it("(a) dismissed reminders stay hidden after a reload", () => {
    const e = editorWith({ general: "Services continued as planned." });
    const before = summaryReminders(JOBY, e, empty);
    assert.equal(before.length, 2);
    let review = empty;
    for (const r of before) review = dismissKey(review, r.key);
    const reloaded = readReviewState(JSON.parse(JSON.stringify(review)));
    assert.deepEqual(summaryReminders(JOBY, e, reloaded), []);
    assert.deepEqual(reloaded.dismissed.sort(), before.map((r) => r.key).sort());
    assert.equal(dismissKey(reloaded, before[0].key), reloaded, "hiding twice changes nothing");
  });
});

describe("rewrite validation", () => {
  it("a date or number in neither the box nor its records is unsupported", () => {
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
  const order: FieldKey[] = ["goal:ils", "goal:talent", "general", "incidentNotes"];
  const current = new Map<FieldKey, string>([
    ["goal:ils", JOBY_EDITOR.goals.ils],
    ["goal:talent", JOBY_EDITOR.goals.talent],
    ["general", JOBY_EDITOR.general],
    ["incidentNotes", "Joby fell on 11/2."],
  ]);
  it("buildDrafts: a made-up date or a lost typed date leaves the box unchanged; each box on its own", () => {
    const res = buildDrafts({
      current,
      proposed: new Map<FieldKey, string>([
        ["goal:ils", "Joby planned and cooked meals with staff and did her own laundry every week."],
        ["goal:talent", "Joby painted at the art center on 9/16 and sold a painting on 9/21."],
        ["incidentNotes", "Joby fell on 11/2 and was checked by staff."],
      ]),
      extra: () => [],
      order,
    });
    assert.deepEqual(res.failed, [
      { field: "goal:talent", reason: "unsupported", facts: ["9/21"] },
      { field: "goal:ils", reason: "dropped", facts: ["8/5", "September"] },
    ]);
    assert.deepEqual(res.drafts, [{ field: "incidentNotes", text: "Joby fell on 11/2 and was checked by staff." }]);
  });
  it("a box's records can supply dates and numbers, and an empty box is drafted from them", () => {
    const res = buildDrafts({
      current: new Map<FieldKey, string>([["goal:talent", ""]]),
      proposed: new Map<FieldKey, string>([["goal:talent", "She painted on 2026-10-04."]]),
      extra: () => ["2026-10-04 Painted at the art center."],
      order: ["goal:talent"],
    });
    assert.deepEqual(res.drafts, [{ field: "goal:talent", text: "She painted on 2026-10-04." }]);
    assert.deepEqual(res.failed, []);
  });
  it("a draft equal to the box changes nothing", () => {
    const res = buildDrafts({
      current: new Map<FieldKey, string>([["general", "Joby is well."]]),
      proposed: new Map<FieldKey, string>([["general", "Joby  is well."]]),
      extra: () => [],
      order: ["general"],
    });
    assert.deepEqual(res.drafts, []);
    assert.deepEqual(res.failed, [{ field: "general", reason: "unchanged", facts: [] }]);
  });
  it("the incident box never says 'no incidents' when there are reports", () => {
    const input = {
      current: new Map<FieldKey, string>([["incidentNotes", ""]]),
      proposed: new Map<FieldKey, string>([["incidentNotes", "There were no incidents this quarter."]]),
      extra: () => ["2026-11-02 Fell in the kitchen."],
      order: ["incidentNotes"] as FieldKey[],
    };
    assert.deepEqual(buildDrafts({ ...input, hasIncidents: true }).failed, [
      { field: "incidentNotes", reason: "no_incidents", facts: [] },
    ]);
    assert.equal(buildDrafts({ ...input, hasIncidents: false }).drafts.length, 1);
    assert.equal(saysNoIncidents("No reportable incidents occurred."), true);
    assert.equal(saysNoIncidents("Joby was incident-free."), true);
    assert.equal(saysNoIncidents("After the fall there were no further incidents."), false);
  });
  it("each failure has a one-line message", () => {
    for (const reason of ["unsupported", "dropped", "no_incidents", "unchanged"] as const) {
      const m = draftFailureMessage({ reason, facts: ["9/21"] });
      assert.ok(m && !m.includes("\n"), reason);
    }
    assert.match(draftFailureMessage({ reason: "dropped", facts: ["8/5"] }), /\(8\/5\)/);
  });
});

describe("Draft and Undo", () => {
  const draft = (field: FieldKey, text: string): BoxDraft => ({ field, text });
  it("a draft replaces the box and marks it Nectar's", () => {
    const e = editorWith({ general: "typed" });
    const { editor, undo } = applyDraft(e, draft("general", "Nectar text"));
    assert.equal(editor.general, "Nectar text");
    assert.equal(editor.nectar.general, "Nectar text");
    assert.deepEqual(undo, { text: "typed", nectar: "" });
  });
  it("(b) Undo restores the exact pre-draft text, step by step", () => {
    const typed = "  Joby painted on 8/5,\n  and played ukulele.  ";
    let editor = editorWith({ goals: { talent: typed }, nectar: { general: "", incidentNotes: "", goals: {} } });
    let stacks: UndoStacks = {};
    const a1 = applyDraft(editor, draft("goal:talent", "First draft."));
    editor = a1.editor;
    stacks = pushUndo(stacks, "goal:talent", a1.undo);
    const a2 = applyDraft(editor, draft("goal:talent", "Second draft."));
    editor = a2.editor;
    stacks = pushUndo(stacks, "goal:talent", a2.undo);
    assert.equal(editor.goals.talent, "Second draft.");

    const u1 = undoDraft(editor, stacks, "goal:talent");
    assert.equal(u1.editor.goals.talent, "First draft.");
    assert.equal(u1.editor.nectar.goals.talent, "First draft.");
    const u2 = undoDraft(u1.editor, u1.stacks, "goal:talent");
    assert.equal(u2.editor.goals.talent, typed, "exactly what was typed");
    assert.equal(u2.editor.nectar.goals.talent ?? "", "", "no longer marked as a Nectar draft");
    const u3 = undoDraft(u2.editor, u2.stacks, "goal:talent");
    assert.equal(u3.editor, u2.editor, "nothing left to undo");
  });
  it("each box has its own Undo", () => {
    const e0 = editorWith({ general: "g", incidentNotes: "i" });
    const a = applyDraft(e0, draft("general", "G"));
    const b2 = applyDraft(a.editor, draft("incidentNotes", "I"));
    const stacks = pushUndo(pushUndo({}, "general", a.undo), "incidentNotes", b2.undo);
    const u = undoDraft(b2.editor, stacks, "general");
    assert.equal(u.editor.general, "g");
    assert.equal(u.editor.incidentNotes, "I", "the other box keeps its draft");
  });
});

describe("review state", () => {
  it("older saves (findings, Keep as is records, suggestion cards) load without errors", () => {
    const r = readReviewState({
      mode: "draft",
      reviewedAt: "2026-10-01T00:00:00Z",
      findings: [{ key: "check:out_of_period:general:8/5", field: "general", kind: "out_of_period", message: "x" }],
      suggestions: [{ field: "general", text: "T", drops: ["8/5"], linked: ["goal:g1"] }, { field: 3 }],
      dismissals: { k: { by: "u", at: "2026-10-01", reason: "because" } },
    });
    assert.equal(r.reviewedAt, "2026-10-01T00:00:00Z");
    assert.equal("suggestions" in r, false, "old suggestion cards are ignored");
    assert.deepEqual(r.dismissed, []);
    assert.deepEqual(r.offArea, {});
    assert.deepEqual(readReviewState(null), emptyReviewState());
    assert.deepEqual(readReviewState("junk"), emptyReviewState());
  });
});
