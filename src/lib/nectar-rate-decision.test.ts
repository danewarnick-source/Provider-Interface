import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideBedrockSlot, EMBED_RATE_LIMITS, orgRateKey } from "./nectar-rate-decision.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("embedding rate limits (N3)", () => {
  it("use their own bucket, separate from the Claude minute", () => {
    assert.equal(EMBED_RATE_LIMITS.key, "bedrock:titan-embed");
    assert.notEqual(EMBED_RATE_LIMITS.key, "bedrock:sonnet");
    assert.equal(orgRateKey(EMBED_RATE_LIMITS.key, ORG), `bedrock:titan-embed:org:${ORG}`);
    assert.equal(orgRateKey("bedrock:sonnet", ORG), `bedrock:sonnet:org:${ORG}`);
  });

  it("let one agency embed a typical policy in seconds but never the whole account quota", () => {
    assert.ok(EMBED_RATE_LIMITS.orgMaxPerMin >= 120, "a 100-section policy fits in one minute");
    assert.ok(EMBED_RATE_LIMITS.orgMaxPerMin < EMBED_RATE_LIMITS.maxPerMin);
    assert.ok(EMBED_RATE_LIMITS.orgDailyTokenCap < EMBED_RATE_LIMITS.dailyTokenCap);
  });
});

describe("decideBedrockSlot", () => {
  const base = { limiterError: null, waitMs: 0, dayTokensUsed: 10, dayFull: false, elapsedMs: 0, maxWaitMs: 60_000 };

  it("grants a free slot and fails closed when the limiter is down", () => {
    assert.deepEqual(decideBedrockSlot(base), { action: "grant", dayTokensUsed: 10 });
    assert.equal(decideBedrockSlot({ ...base, limiterError: "down" }).action, "fail_closed");
  });

  it("waits for the next window, but not past the maximum wait or a full day", () => {
    assert.deepEqual(decideBedrockSlot({ ...base, waitMs: 5_000 }), { action: "wait", waitMs: 5_000 });
    assert.equal(decideBedrockSlot({ ...base, waitMs: 5_000, elapsedMs: 58_000 }).action, "fail_closed");
    assert.equal(decideBedrockSlot({ ...base, waitMs: 5_000, dayFull: true }).action, "fail_closed");
  });
});
