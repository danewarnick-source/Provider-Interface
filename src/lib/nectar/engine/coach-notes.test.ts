import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CoachModel } from "./coach-model.ts";
import {
  describeWhatYouDid,
  NECTAR_OFF_COMPLETENESS_FEEDBACK,
  runDraftShiftNote,
  runEvaluateShiftNote,
  runScanNoteForTriggers,
  validateCoach,
  validateDraft,
  validateScan,
} from "./coach-notes.ts";

// Synthetic note, 39 words. No real people.
const NOTE =
  "Staff prompted Client A to fold laundry after lunch. Client A matched socks with verbal cues, smiled, and said she liked helping. Staff praised the effort and offered a choice of music while they finished the basket together today.";

function fakeModel(reply: string | Record<string, unknown>) {
  const calls: Array<{ system: string; user: string }> = [];
  const model: CoachModel = async (system, user) => {
    calls.push({ system, user });
    return typeof reply === "string" ? reply : JSON.stringify(reply);
  };
  return { model, calls };
}

const ALL_PASS = {
  client_referenced: { passed: true, message: "Names the client." },
  support_provided: { passed: true, message: "Staff prompted." },
  client_response: { passed: true, message: "Client smiled." },
};

describe("validators", () => {
  it("keep their limits and defaults", () => {
    assert.throws(() => validateCoach({ narrative: "" }), /1–8000/);
    assert.throws(() => validateScan({ narrative: "x".repeat(8001) }), /1–8000/);
    assert.throws(() => validateDraft({ shorthand: "ok" }), /3–4000/);
    const coach = validateCoach({ narrative: NOTE, goals: Array.from({ length: 30 }, (_, i) => i) });
    assert.equal(coach.goals.length, 25);
    assert.equal(coach.clientFirstName, "the client");
    assert.equal(validateDraft({ shorthand: "went to the park", followUpAnswers: "  " }).followUpAnswers, undefined);
  });
});

describe("runEvaluateShiftNote", () => {
  it("flags a note under 30 words locally, without calling Nectar", async () => {
    const { model, calls } = fakeModel(ALL_PASS);
    const result = await runEvaluateShiftNote(validateCoach({ narrative: "Short note." }), model);
    assert.equal(result.status, "Flagged");
    assert.equal(result.checks.length, 1);
    assert.equal(calls.length, 0);
  });

  it("with Nectar off for the agency, only the word count gates the note and says so", async () => {
    const result = await runEvaluateShiftNote(validateCoach({ narrative: NOTE }), null);
    assert.equal(result.status, "Verified");
    assert.equal(result.feedback, NECTAR_OFF_COMPLETENESS_FEEDBACK);
    assert.match(result.feedback, /Nectar is turned off for your agency/);
    assert.deepEqual(
      result.checks.map((c) => [c.key, c.passed]),
      [["word_count", true], ["client_referenced", true], ["support_provided", true], ["client_response", true]],
    );
    assert.ok(result.checks.slice(1).every((c) => /not checked/.test(c.message)));
  });

  it("with Nectar on, merges Nectar's three items", async () => {
    const { model, calls } = fakeModel(ALL_PASS);
    const result = await runEvaluateShiftNote(
      validateCoach({ narrative: NOTE, clientFirstName: "Client A", serviceCode: "SLN" }),
      model,
    );
    assert.equal(result.status, "Verified");
    assert.equal(calls.length, 1);
    assert.match(calls[0].system, /submit completeness check/);
    assert.match(calls[0].user, /CLIENT FIRST NAME: Client A/);
    assert.match(calls[0].user, /CHECKED PCSP GOALS \(0\):\n\(none\)/);
  });

  it("flags the note when Nectar fails an item", async () => {
    const { model } = fakeModel({
      ...ALL_PASS,
      support_provided: { passed: false, message: "Say what staff did." },
    });
    const result = await runEvaluateShiftNote(validateCoach({ narrative: NOTE }), model);
    assert.equal(result.status, "Flagged");
    assert.match(result.feedback, /Say what staff did\./);
  });
});

describe("runDraftShiftNote", () => {
  it("returns the draft, its word count and at most three follow-ups", async () => {
    const { model } = fakeModel({
      draft: "  Staff prompted Client A to fold laundry.  ",
      followUps: [{ question: " What did you say? " }, { question: "" }, { question: "b" }, { question: "c" }, { question: "d" }],
    });
    const result = await runDraftShiftNote(
      validateDraft({ shorthand: NOTE, goals: ["Folds laundry"], clientFirstName: "Client A" }),
      model,
    );
    assert.equal(result.draft, "Staff prompted Client A to fold laundry.");
    assert.equal(result.wordCount, 7);
    assert.deepEqual(result.followUps.map((f) => f.question), ["What did you say?", "b", "c"]);
  });

  it("folds follow-up answers in and asks nothing more", async () => {
    const { model, calls } = fakeModel({ draft: "A draft.", followUps: [{ question: "More?" }] });
    const result = await runDraftShiftNote(
      validateDraft({ shorthand: NOTE, goals: ["Folds laundry"], followUpAnswers: "Q: x\nA: y" }),
      model,
    );
    assert.deepEqual(result.followUps, []);
    assert.match(calls[0].system, /Follow-up answers ARE provided/);
    assert.match(calls[0].user, /STAFF ANSWERS TO NECTAR FOLLOW-UPS/);
  });

  it("with no goals and nothing described, asks the team member what they did (no model call)", async () => {
    const { model, calls } = fakeModel({ draft: "Client A had a calm day with baseline support." });
    for (const shorthand of ["good shift", "n/a nothing to report", "No issues, client was fine."]) {
      await assert.rejects(
        runDraftShiftNote(validateDraft({ shorthand, goals: [], clientFirstName: "Client A" }), model),
        { message: describeWhatYouDid("Client A") },
      );
    }
    assert.equal(calls.length, 0);
    assert.match(describeWhatYouDid("the client"), /^Describe what you did with the client during this shift/);
  });

  it("never asks the model for a baseline narrative, and asks the person when it writes none", async () => {
    const { model, calls } = fakeModel({ draft: "" });
    await assert.rejects(
      runDraftShiftNote(validateDraft({ shorthand: "park, soda, calm", goals: [], clientFirstName: "Client A" }), model),
      { message: describeWhatYouDid("Client A") },
    );
    assert.match(calls[0].user, /CHECKED PCSP GOALS \(0\):\n\(none\)\n/);
    assert.doesNotMatch(calls[0].user, /baseline/);
    assert.match(calls[0].system, /Never invent activities/);
    assert.match(calls[0].system, /never a general or baseline narrative/);
  });

  it("drafts from a described activity even without goals", async () => {
    const { model } = fakeModel({ draft: "Staff supported Client A at the park." });
    const result = await runDraftShiftNote(
      validateDraft({ shorthand: "park, soda, calm", goals: [], clientFirstName: "Client A" }),
      model,
    );
    assert.equal(result.draft, "Staff supported Client A at the park.");
  });

  it("refuses to hand back an empty draft", async () => {
    const { model } = fakeModel({ draft: "   " });
    await assert.rejects(
      runDraftShiftNote(validateDraft({ shorthand: NOTE, goals: ["Folds laundry"] }), model),
      /could not generate a draft/,
    );
  });
});

describe("runScanNoteForTriggers", () => {
  it("returns plain flags and drops a malformed trigger list", async () => {
    const { model } = fakeModel({ hasIncidentTrigger: 1, triggerTypes: "fall", triggerSummary: 5 });
    assert.deepEqual(await runScanNoteForTriggers(validateScan({ narrative: NOTE }), model), {
      hasIncidentTrigger: true,
      hasMedicalTrigger: false,
      hasEmarTrigger: false,
      triggerTypes: [],
      triggerSummary: "",
    });
  });

  it("passes the narrative to the scanner prompt", async () => {
    const { model, calls } = fakeModel({ triggerTypes: ["fall"], triggerSummary: "A fall." });
    const result = await runScanNoteForTriggers(validateScan({ narrative: NOTE }), model);
    assert.deepEqual(result.triggerTypes, ["fall"]);
    assert.match(calls[0].system, /compliance trigger scanner/);
    assert.ok(calls[0].user.includes(NOTE));
  });
});
