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
  acceptSuggestion,
  blankGoals,
  buildSuggestions,
  dedupeFields,
  dismissKey,
  droppedFacts,
  emptyReviewState,
  findDates,
  goalCovered,
  goalsNeedingAreaCheck,
  pushUndo,
  readReviewState,
  suggestionKey,
  summaryReminders,
  takeSuggestion,
  undoAccept,
  unsupportedFacts,
  visibleSuggestion,
  type FieldKey,
  type FieldSuggestion,
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
  it("no off-goal, misplaced or vague reminders exist; only the four fixed kinds", () => {
    const blank = summaryReminders(JOBY, editorWith({ general: "x" }), empty);
    const kinds = new Set(blank.map((r) => r.kind));
    for (const k of kinds) assert.ok(["no_progress", "off_area", "response", "events"].includes(k));
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
  it("general notes: at most two (response, notable events), only once something is typed", () => {
    assert.deepEqual(summaryReminders(JOBY, emptyEditorState(), empty).filter((r) => r.field === "general"), []);
    const rem = summaryReminders(JOBY, editorWith({ goals: JOBY_EDITOR.goals, general: "Services continued as planned." }), empty);
    assert.deepEqual(
      rem.map((r) => r.kind),
      ["response", "events"],
    );
    assert.ok(rem.length <= 2);
  });
  it("an incident note counts as notable events", () => {
    const rem = summaryReminders(
      JOBY,
      editorWith({ goals: JOBY_EDITOR.goals, general: "Joby is happy.", incidentNotes: "No incidents." }),
      empty,
    );
    assert.deepEqual(rem, []);
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
    assert.ok(before.length >= 3);
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
  it("buildSuggestions: a made-up date is rejected, a lossy rewrite is flagged, each box on its own", () => {
    const res = buildSuggestions({
      current,
      proposed: new Map<FieldKey, string>([
        ["goal:ils", "Joby planned and cooked meals with staff and did her own laundry every week."],
        ["goal:talent", "Joby painted at the art center on 9/16 and sold a painting on 9/21."],
        ["incidentNotes", "Joby fell on 11/2 and was checked by staff."],
      ]),
      extra: () => [],
      order,
    });
    assert.deepEqual(res.rejected, [{ field: "goal:talent", facts: ["9/21"] }]);
    const ils = res.suggestions.find((s) => s.field === "goal:ils");
    assert.deepEqual(ils?.drops, ["8/5", "September"], "the typed dates are lost");
    const inc = res.suggestions.find((s) => s.field === "incidentNotes");
    assert.deepEqual(inc?.drops, []);
    assert.ok(res.suggestions.every((s) => !("linked" in s)));
  });
  it("a goal's records can supply dates and numbers for that goal's box", () => {
    const res = buildSuggestions({
      current: new Map<FieldKey, string>([["goal:talent", "She painted."]]),
      proposed: new Map<FieldKey, string>([["goal:talent", "She painted on 2026-10-04."]]),
      extra: () => ["2026-10-04 Painted at the art center."],
      order: ["goal:talent"],
    });
    assert.equal(res.suggestions.length, 1);
    assert.deepEqual(res.rejected, []);
  });
  it("a rewrite equal to the box is not offered", () => {
    const res = buildSuggestions({
      current: new Map<FieldKey, string>([["general", "Joby is well."]]),
      proposed: new Map<FieldKey, string>([["general", "Joby  is well."]]),
      extra: () => [],
      order: ["general"],
    });
    assert.deepEqual(res.suggestions, []);
  });
});

describe("Accept and Undo", () => {
  const sug = (field: FieldKey, text: string, drops: string[] = []): FieldSuggestion => ({ field, text, drops });
  it("Accept writes the box and marks it Nectar's; a rewrite that drops something is refused", () => {
    const e = editorWith({ general: "typed" });
    const { editor } = acceptSuggestion(e, sug("general", "Nectar text"));
    assert.equal(editor.general, "Nectar text");
    assert.equal(editor.nectar.general, "Nectar text");
    assert.throws(() => acceptSuggestion(e, sug("general", "x", ["8/5"])), /drops something/);
  });
  it("(b) Undo restores the exact pre-Accept text, and a second Accept undoes step by step", () => {
    const typed = "  Joby painted on 8/5,\n  and played ukulele.  ";
    let editor = editorWith({ goals: { talent: typed }, nectar: { general: "", incidentNotes: "", goals: {} } });
    let stacks: UndoStacks = {};
    const a1 = acceptSuggestion(editor, sug("goal:talent", "First rewrite."));
    editor = a1.editor;
    stacks = pushUndo(stacks, "goal:talent", a1.undo);
    const a2 = acceptSuggestion(editor, sug("goal:talent", "Second rewrite."));
    editor = a2.editor;
    stacks = pushUndo(stacks, "goal:talent", a2.undo);
    assert.equal(editor.goals.talent, "Second rewrite.");

    const u1 = undoAccept(editor, stacks, "goal:talent");
    assert.equal(u1.editor.goals.talent, "First rewrite.");
    assert.equal(u1.editor.nectar.goals.talent, "First rewrite.");
    const u2 = undoAccept(u1.editor, u1.stacks, "goal:talent");
    assert.equal(u2.editor.goals.talent, typed, "exactly what was typed");
    assert.equal(u2.editor.nectar.goals.talent ?? "", "", "no longer marked as a Nectar draft");
    const u3 = undoAccept(u2.editor, u2.stacks, "goal:talent");
    assert.equal(u3.editor, u2.editor, "nothing left to undo");
  });
  it("Undo restores a box edited after Accept to the pre-Accept text", () => {
    const e0 = editorWith({ general: "before" });
    const a = acceptSuggestion(e0, sug("general", "after"));
    const edited = { ...a.editor, general: "after, plus my edit" };
    const u = undoAccept(edited, pushUndo({}, "general", a.undo), "general");
    assert.equal(u.editor.general, "before");
  });
});

describe("review state", () => {
  it("dismissing a suggestion card hides it for good; a new draft shows again", () => {
    const s1: FieldSuggestion = { field: "general", text: "One.", drops: [] };
    let review: SummaryReviewState = { ...empty, suggestions: [s1] };
    assert.equal(visibleSuggestion(review, "general")?.text, "One.");
    review = dismissKey(review, suggestionKey(s1));
    const reloaded = readReviewState(JSON.parse(JSON.stringify(review)));
    assert.equal(visibleSuggestion(reloaded, "general"), null);
    const s2 = { ...s1, text: "Two." };
    assert.equal(visibleSuggestion({ ...reloaded, suggestions: [s2] }, "general")?.text, "Two.");
    assert.deepEqual(takeSuggestion(review, "general").suggestions, []);
  });
  it("older saves (findings, Keep as is records, linked suggestions) load without errors", () => {
    const r = readReviewState({
      mode: "draft",
      reviewedAt: "2026-10-01T00:00:00Z",
      findings: [{ key: "check:out_of_period:general:8/5", field: "general", kind: "out_of_period", message: "x" }],
      suggestions: [{ field: "general", text: "T", drops: ["8/5"], linked: ["goal:g1"] }, { field: 3 }],
      dismissals: { k: { by: "u", at: "2026-10-01", reason: "because" } },
    });
    assert.equal(r.reviewedAt, "2026-10-01T00:00:00Z");
    assert.deepEqual(r.suggestions, [{ field: "general", text: "T", drops: ["8/5"] }]);
    assert.deepEqual(r.dismissed, []);
    assert.deepEqual(r.offArea, {});
    assert.deepEqual(readReviewState(null), emptyReviewState());
    assert.deepEqual(readReviewState("junk"), emptyReviewState());
  });
});
