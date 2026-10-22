import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STRATEGY_SYSTEM_PROMPT,
  codeGuidance,
  parseStrategyReply,
  strategyUserPrompt,
} from "./strategy-prompt.ts";
import type { StrategySupport } from "./support-strategies.ts";

const supports: StrategySupport[] = [
  {
    supportId: "a",
    goal: "Sam will cook.",
    support: "Coach Sam in the kitchen.",
    details: "",
    codes: ["SLH"],
  },
  {
    supportId: "b",
    goal: "Sam will keep a job.",
    support: "Job coaching.",
    details: "Mornings",
    codes: ["SEI"],
  },
];
const good = [
  "Staff offer a choice.",
  "Staff model one step.",
  "Staff wait for Sam.",
  "Staff praise effort.",
];

describe("strategy prompt", () => {
  it("asks for 4–6 bullets and encodes the contract rules", () => {
    assert.match(STRATEGY_SYSTEM_PROMPT, /4 to 6 bullet points/);
    assert.match(STRATEGY_SYSTEM_PROMPT, /Never invent facts/);
    assert.match(STRATEGY_SYSTEM_PROMPT, /fade paid employment support/);
    assert.match(STRATEGY_SYSTEM_PROMPT, /needs, strengths, abilities and interests/);
  });

  it("numbers the supports with their codes and code rules", () => {
    const u = strategyUserPrompt(supports);
    assert.match(u, /1\. Goal: Sam will cook\./);
    assert.match(u, /Support details: None listed/);
    assert.match(u, /Service codes: SEI\n {3}Rule: Employment/);
    assert.deepEqual(codeGuidance(["SJD"]).length, 1);
    assert.deepEqual(codeGuidance(["SLH"]), []);
  });
});

describe("parseStrategyReply", () => {
  it("keeps valid bullets by support number and reports the rest", () => {
    const raw = JSON.stringify({
      strategies: [
        { n: 2, bullets: good.slice(0, 2) },
        { n: 1, bullets: good },
      ],
    });
    const r = parseStrategyReply(`\`\`\`json\n${raw}\n\`\`\``, supports);
    assert.deepEqual(r.drafts.get("a"), good);
    assert.equal(r.drafts.has("b"), false);
    assert.equal(r.failed[0].support.supportId, "b");
    assert.match(r.failed[0].problem, /got 2/);
  });

  it("fails every support on an unreadable reply", () => {
    const r = parseStrategyReply("not json", supports);
    assert.equal(r.drafts.size, 0);
    assert.deepEqual(
      r.failed.map((f) => f.problem),
      ["no bullet points", "no bullet points"],
    );
  });
});
