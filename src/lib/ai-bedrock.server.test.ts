import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./ai-bedrock.server.ts", import.meta.url), "utf8");

function embeddings(): string {
  const start = SRC.indexOf("export async function gatewayEmbeddingsFetch(");
  assert.ok(start >= 0, "gatewayEmbeddingsFetch is still exported");
  return SRC.slice(start);
}

describe("ai-bedrock.server.ts embeddings (N3)", () => {
  it("embeds with Titan Text Embeddings v2 at size 1024 unless 256 or 512 is asked for", () => {
    const fn = embeddings();
    assert.match(fn, /"amazon\.titan-embed-text-v2:0"/);
    assert.match(fn, /\[256, 512, 1024\]\.includes\(body\.dimensions\)/);
    assert.match(fn, /\? body\.dimensions\s*: 1024;/);
  });

  it("takes each input's slot from the embeddings buckets, charged to the caller's agency", () => {
    const fn = embeddings();
    assert.match(fn, /await acquireBedrockSlot\(opts\?\.orgId, "embed"\);/);
    assert.match(fn, /recordBedrockTokens\(parsed\.inputTextTokenCount, opts\?\.orgId, "embed"\)/);
  });

  it("leaves the Claude calls on the chat buckets", () => {
    const chat = SRC.slice(0, SRC.indexOf("// OpenAI-compatible embeddings shim"));
    assert.ok(chat.length > 1000);
    assert.doesNotMatch(chat, /"embed"/);
    assert.match(chat, /await acquireBedrockSlot\(req\.orgId\);/);
  });
});
