import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NECTAR_SETTING_OFF_MESSAGE } from "./guard.ts";
import {
  ASK_OFF_ANSWER,
  askOffResult,
  askResult,
  NECTAR_AI_LABEL,
  NOT_FOUND_ANSWER,
  PAY_HOURS_REFUSAL,
} from "./ask-types.ts";

describe("askNectar's answer shape (N5)", () => {
  it("labels every answer as AI and defaults to not found, no sources, nothing logged", () => {
    assert.equal(NECTAR_AI_LABEL, "Nectar · AI assistant");
    assert.deepEqual(askResult(NOT_FOUND_ANSWER), {
      answer: NOT_FOUND_ANSWER,
      sources: [],
      found: false,
      questionId: null,
      refusal: null,
      label: NECTAR_AI_LABEL,
    });
  });

  it("uses the runbook's wording for not found, the pay refusal and Ask turned off", () => {
    assert.equal(NOT_FOUND_ANSWER, "I couldn't find that in your agency's documents.");
    assert.equal(
      PAY_HOURS_REFUSAL,
      "Nectar doesn't answer pay or hours questions. Ask your supervisor or the office.",
    );
    assert.equal(ASK_OFF_ANSWER, NECTAR_SETTING_OFF_MESSAGE.ask);
    assert.deepEqual(askOffResult(), { ...askResult(ASK_OFF_ANSWER), refusal: "off" });
  });
});
