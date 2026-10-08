import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GoalView } from "./plans.ts";
import { approvedStrategies, shiftFocus } from "./shift-focus.ts";
import { agencySupports, buildStrategySections } from "./support-strategies.ts";

const goals: GoalView[] = [
  {
    id: "g1",
    kind: "goal",
    goal: "Ana will cook.",
    domain: null,
    supports: [
      { id: "s1", support_text: "Coach Ana.", details: "Picture recipes", our_codes: ["SLH"] },
      { id: "s2", support_text: "Clean up together.", details: null, our_codes: ["SLH"] },
    ],
  },
  {
    id: "g2",
    kind: "goal",
    goal: "Ana will walk daily.",
    domain: null,
    supports: [{ id: "s3", support_text: "Walk with Ana.", details: null, our_codes: ["SLH"] }],
  },
];
const sections = buildStrategySections(
  agencySupports(goals),
  [],
  new Map([
    ["s1", "- Staff read the recipe aloud.\n- Staff hand Ana one tool at a time."],
    ["s3", "- Staff invite Ana to pick the route."],
  ]),
);
const row = { status: "published", approved_at: "2026-09-01T00:00:00Z", content: { sections } };

describe("approvedStrategies", () => {
  it("is empty unless published and approved", () => {
    assert.deepEqual(approvedStrategies({ ...row, status: "draft" }), []);
    assert.deepEqual(approvedStrategies(null), []);
    assert.deepEqual(
      approvedStrategies(row).map((s) => s.supportId),
      ["s1", "s3"],
    );
  });
});

describe("shiftFocus", () => {
  it("consolidates to one line per goal with its first strategy", () => {
    const f = shiftFocus(goals, approvedStrategies(row));
    assert.deepEqual(f.lines, [
      { goal: "Ana will cook.", bullets: ["Staff read the recipe aloud."] },
      { goal: "Ana will walk daily.", bullets: ["Staff invite Ana to pick the route."] },
    ]);
    assert.equal(f.hasStrategies, true);
    assert.equal(f.goals[0].supports[0].details, "Picture recipes");
    assert.equal(f.goals[0].supports[0].bullets.length, 2);
  });

  it("shows two strategies for a single goal, and supports when none are approved", () => {
    const one = shiftFocus(goals.slice(0, 1), approvedStrategies(row));
    assert.equal(one.lines[0].bullets.length, 2);
    const none = shiftFocus(goals, []);
    assert.deepEqual(none.lines[0], { goal: "Ana will cook.", bullets: ["Coach Ana."] });
    assert.equal(none.hasStrategies, false);
  });

  it("caps the consolidated view at 3 goals and matches by wording after a new PCSP", () => {
    const many = [0, 1, 2, 3].map((i) => ({ ...goals[1], id: `g${i}`, goal: `Goal ${i}` }));
    assert.equal(shiftFocus(many, []).lines.length, 3);
    const renamed = [{ ...goals[1], supports: [{ ...goals[1].supports[0], id: "new" }] }];
    assert.deepEqual(shiftFocus(renamed, approvedStrategies(row)).lines[0].bullets, [
      "Staff invite Ana to pick the route.",
    ]);
  });
});
