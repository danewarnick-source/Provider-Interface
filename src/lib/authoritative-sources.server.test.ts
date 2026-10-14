import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { AUTH_KINDS } from "./authoritative-sources.server.ts";

describe("authoritative-sources.server (N2, N4)", () => {
  it("keeps the source kinds a document can be marked with", () => {
    assert.deepEqual(
      [...AUTH_KINDS],
      [
        "state_sow",
        "provider_contract",
        "dspd_requirement",
        "dhs_requirement",
        "public_record",
        "tool_template",
        "provider_policy",
        "other",
      ],
    );
  });

  it("holds no prompts, extraction or web capture now that their screens are gone", () => {
    const src = readFileSync(new URL("./authoritative-sources.server.ts", import.meta.url), "utf8");
    assert.doesNotMatch(src, /ai-bedrock|gatewayFetch|SYSTEM_PROMPT|extract|RateLimitError/);
    assert.doesNotMatch(src, /stripHtmlToText/);
    assert.ok(src.split("\n").length <= 300);
  });
});
