import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./text.server.ts", import.meta.url), "utf8");

describe("text.server.ts (N3)", () => {
  it("keeps a PDF's line breaks page by page, so headings stay on their own lines", () => {
    assert.match(SRC, /extractText\(pdf, \{ mergePages: false \}\)/);
    assert.doesNotMatch(SRC, /mergePages: true/);
  });

  it("reads Word with mammoth and text as UTF-8; anything else is kept with no text", () => {
    assert.match(SRC, /extractRawText\(\{ buffer: Buffer\.from\(bytes\) \}\)/);
    assert.match(SRC, /new TextDecoder\(\)\.decode\(bytes\)/);
    assert.match(SRC, /return \{ \.\.\.parseOutcome\(""\), parse_error: null \};/);
  });

  it("a broken file is 'failed' with a plain message, never the file's contents", () => {
    assert.match(SRC, /parse_status: "failed", parse_error: "The file could not be read\." \}/);
    assert.doesNotMatch(SRC, /console\./);
  });

  it("stores typed text in the nectar-documents bucket, overwriting the draft's own file", () => {
    assert.match(
      SRC,
      /\.upload\(path, bytes, \{ contentType: "text\/plain; charset=utf-8", upsert: true \}\)/,
    );
    assert.match(SRC, /bucket = LIBRARY_BUCKET/);
  });
});
