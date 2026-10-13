import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./nectar-rate-limit.server.ts", import.meta.url), "utf8");

describe("nectar-rate-limit.server.ts (N3)", () => {
  it("keeps the Claude limits: 8 a minute for the account, 4 a minute and 1.5M tokens a day per agency", () => {
    assert.match(SRC, /export const BEDROCK_RATE_KEY = "bedrock:sonnet";/);
    assert.match(SRC, /export const BEDROCK_MAX_PER_MIN = 8;/);
    assert.match(SRC, /export const BEDROCK_ORG_MAX_PER_MIN = 4;/);
    assert.match(SRC, /export const BEDROCK_ORG_DAILY_TOKEN_CAP = 1_500_000;/);
  });

  it("counts embeddings in their own buckets, per agency as well as account-wide", () => {
    assert.match(SRC, /return kind === "embed" \? EMBED_RATE_LIMITS : CHAT_RATE_LIMITS;/);
    assert.match(SRC, /kind: BedrockRateKind = "chat",\n\): Promise<\{ dayTokensUsed: number \}>/);
    assert.match(SRC, /const orgKey = scoped \? orgRateKey\(limits\.key, scoped\) : null;/);
    assert.match(SRC, /probeRate\(orgKey, limits\.orgMaxPerMin, limits\.orgDailyTokenCap\)/);
    assert.match(SRC, /probeRate\(limits\.key, limits\.maxPerMin, limits\.dailyTokenCap\)/);
    assert.match(SRC, /const keys = scoped \? \[key, orgRateKey\(key, scoped\)\] : \[key\];/);
  });

  it("fits the lib size limit", () => {
    assert.ok(SRC.split("\n").length <= 300);
  });
});
