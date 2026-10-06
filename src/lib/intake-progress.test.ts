import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intakeState, summarizeIntake } from "./intake-progress.ts";

const reqs = [
  { id: "a", conditional: null },
  { id: "b", conditional: null },
  { id: "c", conditional: "HHS only" },
];

describe("summarizeIntake", () => {
  it("counts only unconditional items; complete and waived satisfy", () => {
    const s = new Map([
      ["a", "complete"],
      ["b", "waived"],
      ["c", "not_started"],
    ]);
    assert.deepEqual(summarizeIntake(reqs, s), { required: 2, satisfied: 2 });
    assert.deepEqual(summarizeIntake(reqs, new Map([["a", "in_progress"]])), {
      required: 2,
      satisfied: 0,
    });
  });
});

describe("intakeState", () => {
  it("maps progress to a chip state", () => {
    assert.equal(intakeState(undefined), "none");
    assert.equal(intakeState({ required: 0, satisfied: 0 }), "none");
    assert.equal(intakeState({ required: 3, satisfied: 0 }), "not_started");
    assert.equal(intakeState({ required: 3, satisfied: 1 }), "partial");
    assert.equal(intakeState({ required: 3, satisfied: 3 }), "complete");
  });
});
