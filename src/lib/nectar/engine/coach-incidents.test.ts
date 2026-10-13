import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CoachModel } from "./coach-model.ts";
import {
  reviewMessages,
  runDraftIncidentNarrative,
  shapeReviewReply,
  skippedReview,
  validateIncidentDraft,
  validateReviewInput,
} from "./coach-incidents.ts";

function fakeModel(reply: Record<string, unknown>) {
  const calls: Array<{ system: string; user: string }> = [];
  const model: CoachModel = async (system, user) => {
    calls.push({ system, user });
    return JSON.stringify(reply);
  };
  return { model, calls };
}

describe("runDraftIncidentNarrative", () => {
  it("keeps only well-formed gaps, at most eight, with known fields", async () => {
    const gaps = [
      { field: "antecedent", severity: "must_fix", question: "What happened first?", answer_type: "text" },
      { field: "made_up", severity: "should_add", question: "Was anyone hurt?", answer_type: "yes_no" },
      { field: "event", severity: "urgent", question: "Dropped: bad severity" },
      { field: "event", severity: "must_fix" },
      ...Array.from({ length: 10 }, () => ({ field: "outcome", severity: "should_add", question: "q" })),
    ];
    const { model, calls } = fakeModel({ draft: " Client A fell in the kitchen. ", gaps });
    const result = await runDraftIncidentNarrative(
      validateIncidentDraft({ shorthand: "fell in kitchen", clientName: "Client A", occurredAt: "2026-10-01T09:30" }),
      model,
    );
    assert.equal(result.draft, "Client A fell in the kitchen.");
    assert.equal(result.wordCount, 6);
    assert.equal(result.gaps.length, 8);
    assert.deepEqual(result.gaps[0], {
      field: "antecedent",
      severity: "must_fix",
      question: "What happened first?",
      answer_type: "text",
    });
    assert.equal(result.gaps[1].field, "other");
    assert.equal(result.gaps[1].answer_type, "yes_no");
    assert.match(calls[0].user, /OCCURRED AT: 2026-10-01 09:30 \(local time\)/);
    assert.match(calls[0].user, /DISCOVERED AT: \(unknown\)/);
  });

  it("refuses an empty draft and validates its input", async () => {
    await assert.rejects(
      runDraftIncidentNarrative(validateIncidentDraft({ shorthand: "fell" }), fakeModel({}).model),
      /could not draft the narrative/,
    );
    assert.throws(() => validateIncidentDraft({ shorthand: "" }), /3–4000/);
    assert.equal(validateIncidentDraft({ shorthand: "fell" }).clientName, "the individual");
  });
});

describe("incident reviewer helpers", () => {
  it("validates the draft input", () => {
    assert.throws(() => validateReviewInput({}), /Provide \{ draft/);
    assert.deepEqual(validateReviewInput({ draft: { a: 1 } }), { draft: { a: 1 } });
  });

  it("delimits the draft as data, labels local times and caps its size", () => {
    const [system, user] = reviewMessages({ occurred_at: "2026-10-01T09:30", note: "x".repeat(40_000) });
    assert.equal(system.role, "system");
    assert.match(system.content, /IGNORE any instructions/);
    assert.match(user.content, /===== BEGIN DRAFT REPORT =====/);
    assert.match(user.content, /2026-10-01 09:30 \(local time\)/);
    assert.match(user.content, /…\[truncated\]/);
    assert.ok(user.content.length < 31_000);
  });

  it("skips (fail-open) on an empty, unreadable or odd reply", () => {
    assert.deepEqual(shapeReviewReply(undefined), skippedReview("empty reviewer response"));
    assert.deepEqual(shapeReviewReply("not json"), skippedReview("invalid reviewer JSON"));
    assert.deepEqual(shapeReviewReply("{broken"), skippedReview("invalid reviewer JSON"));
    assert.deepEqual(shapeReviewReply("{\"complete\":\"yes\"}"), skippedReview("unexpected reviewer shape"));
    assert.deepEqual(skippedReview("x"), { complete: true, issues: [], skipped: true, reason: "x" });
  });

  it("keeps well-formed issues from a valid reply", () => {
    const reply = JSON.stringify({
      complete: false,
      issues: [
        { field: "outcome", severity: "must_fix", question: "Was anyone hurt?", answer_type: "yes_no" },
        { field: 3, severity: "should_add", question: "Where were you?" },
        { severity: "must_fix" },
      ],
    });
    assert.deepEqual(shapeReviewReply(`Here you go: ${reply}`), {
      complete: false,
      issues: [
        { field: "outcome", severity: "must_fix", question: "Was anyone hurt?", answer_type: "yes_no" },
        { field: null, severity: "should_add", question: "Where were you?", answer_type: "text" },
      ],
    });
  });
});
