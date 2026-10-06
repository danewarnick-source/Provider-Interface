import { test } from "node:test";
import assert from "node:assert/strict";
import { goalSimilarity, proposeCarryOver } from "./carry-over.ts";

const lastYear = [
  { goal: "Pat will cook a simple meal each week.", ongoing: true, status: "Partially met" },
  { goal: "Pat will ride the bus to the library.", ongoing: false, status: "Met" },
];
const current = [
  { id: "g-cook", goal_text: "Pat will cook a simple meal each week." },
  { id: "g-bus", goal_text: "Pat will ride the bus to the library." },
];

test("similarity ignores case, punctuation and filler words", () => {
  assert.equal(goalSimilarity("Pat will cook a meal.", "pat cook meal"), 1);
  assert.equal(goalSimilarity("", "anything"), 0);
});

test("same goal continues, new goal is new, unmatched old goal ends", () => {
  const out = proposeCarryOver(
    ["Pat will cook a simple meal each week.", "Pat will work at a job in the community."],
    current,
    lastYear,
  );
  assert.deepEqual(out, {
    goals: [
      { index: 0, kind: "continuing", fromGoalId: "g-cook", fromGoalText: current[0].goal_text, similarity: 1, ongoing: true },
      { index: 1, kind: "new", fromGoalId: null, fromGoalText: null, similarity: 0, ongoing: null },
    ],
    ended: [{ goalId: "g-bus", goalText: current[1].goal_text, ongoing: false }],
  });
});

test("a reworded goal marked ongoing is proposed as changed", () => {
  const out = proposeCarryOver(["Pat will cook dinner twice a week with staff."], current, lastYear);
  assert.equal(out.goals[0].kind, "changed");
  assert.equal(out.goals[0].fromGoalId, "g-cook");
});

test("each current goal is matched at most once, best match wins", () => {
  const out = proposeCarryOver(
    ["Pat will cook a meal each week.", "Pat will cook a simple meal each week."],
    current,
    lastYear,
  );
  assert.equal(out.goals[1].fromGoalId, "g-cook");
  assert.equal(out.goals[0].kind, "new");
});
