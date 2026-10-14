import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AskInput, AskStatusInput, FeedbackInput, QUESTION_MAX } from "./ask-input.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const Q = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("askNectar input", () => {
  it("takes an agency, a question and the screen's view, trimmed", () => {
    assert.deepEqual(
      AskInput.parse({
        organizationId: ORG,
        question: "  What is the fire plan?  ",
        view: "staff",
      }),
      {
        organizationId: ORG,
        question: "What is the fire plan?",
        view: "staff",
      },
    );
  });

  it("refuses an empty or too long question, an unknown view and a bad agency id", () => {
    assert.throws(() => AskInput.parse({ organizationId: ORG, question: " a ", view: "staff" }));
    assert.throws(() =>
      AskInput.parse({
        organizationId: ORG,
        question: "x".repeat(QUESTION_MAX + 1),
        view: "staff",
      }),
    );
    assert.throws(() =>
      AskInput.parse({ organizationId: ORG, question: "Hello there", view: "owner" }),
    );
    assert.throws(() =>
      AskInput.parse({ organizationId: "nope", question: "Hello there", view: "admin" }),
    );
  });

  it("carries no client, role or scope from the request", () => {
    const parsed = AskInput.parse({
      organizationId: ORG,
      question: "Hello there",
      view: "staff",
      clientId: Q,
      role: "owner",
      scope: "agency",
    });
    assert.deepEqual(Object.keys(parsed).sort(), ["organizationId", "question", "view"]);
  });
});

describe("getAskStatus input (N6)", () => {
  it("takes only an agency id", () => {
    assert.deepEqual(AskStatusInput.parse({ organizationId: ORG, view: "admin" }), {
      organizationId: ORG,
    });
    assert.throws(() => AskStatusInput.parse({ organizationId: "nope" }));
  });
});

describe("feedbackNectar input", () => {
  it("takes a question id and up or down", () => {
    assert.deepEqual(FeedbackInput.parse({ organizationId: ORG, questionId: Q, value: "down" }), {
      organizationId: ORG,
      questionId: Q,
      value: "down",
    });
    assert.throws(() => FeedbackInput.parse({ organizationId: ORG, questionId: Q, value: "meh" }));
    assert.throws(() =>
      FeedbackInput.parse({ organizationId: ORG, questionId: "q-1", value: "up" }),
    );
  });
});
