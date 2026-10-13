import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CoachModel } from "./coach-model.ts";
import { runAnswerProcedural, validateProcedural } from "./coach-assist.ts";

function fakeModel(reply: Record<string, unknown>) {
  const calls: Array<{ system: string; user: string }> = [];
  const model: CoachModel = async (system, user) => {
    calls.push({ system, user });
    return JSON.stringify(reply);
  };
  return { model, calls };
}

describe("validateProcedural", () => {
  it("keeps its limits and defaults", () => {
    assert.throws(() => validateProcedural({ question: "ok?" }), /4–500/);
    const p = validateProcedural({ question: "Can I drive to the store?", pcspGoals: ["a", 2] });
    assert.deepEqual(p.pcspGoals, ["a", "2"]);
    assert.equal(p.notes, null);
  });
});

describe("runAnswerProcedural", () => {
  it("returns the answer with a known confidence and the escalate flag", async () => {
    const { model, calls } = fakeModel({ answer: " Yes, log the trip. ", confidence: "high", escalate: 1 });
    const result = await runAnswerProcedural(
      validateProcedural({ question: "Can I drive to the store?", clientFirstName: "Client A" }),
      model,
    );
    assert.deepEqual(result, { answer: "Yes, log the trip.", confidence: "high", escalate: true });
    assert.match(calls[0].system, /procedural assistant/);
    assert.match(calls[0].user, /PCSP GOALS \(0\):\n\(none on file\)/);
  });

  it("treats an unknown confidence as medium and refuses an empty answer", async () => {
    const medium = await runAnswerProcedural(
      validateProcedural({ question: "Can I drive to the store?" }),
      fakeModel({ answer: "Check the plan.", confidence: "certain" }).model,
    );
    assert.equal(medium.confidence, "medium");
    assert.equal(medium.escalate, false);
    await assert.rejects(
      runAnswerProcedural(validateProcedural({ question: "Can I drive?" }), fakeModel({ answer: "" }).model),
      /could not produce an answer/,
    );
  });
});
