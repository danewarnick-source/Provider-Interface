import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./index.server.ts", import.meta.url), "utf8");

function body(name: string): string {
  const start = SRC.search(new RegExp(`(export )?(async )?function ${name}\\(`));
  assert.ok(start >= 0, `${name} exists`);
  const next = SRC.slice(start + 1).search(/\n(export )?(async )?function /);
  return SRC.slice(start, next < 0 ? undefined : start + 1 + next);
}

describe("index.server.ts (N3)", () => {
  it("removes an old version from search by flagging its sections, never deleting them", () => {
    const retire = body("retireSections");
    assert.match(retire, /\.update\(\{ retired_at: new Date\(\)\.toISOString\(\) \}\)/);
    assert.match(retire, /\.is\("retired_at", null\)/);
    assert.doesNotMatch(SRC, /\.delete\(/);
  });

  it("writes every section of the version at once, with embeddings made in time", () => {
    const write = body("writeSections");
    assert.match(write, /const sections = splitSections\(text\);/);
    assert.match(write, /opts\.embed\s*\?\s*await embedAll\(/);
    assert.match(write, /\.from\("knowledge_sections"\)\.insert\(rows\.slice\(i, i \+ 100\)\)/);
  });

  it("re-indexing a version replaces its sections in search, and old cut text is re-read from the file", () => {
    const library = body("indexLibraryVersion");
    const text = library.indexOf('await fullText(db, doc, "nectar_documents")');
    const retire = library.indexOf("await retireSections(db, { documentId: doc.id })");
    assert.ok(text >= 0 && retire > text);
    assert.match(body("fullText"), /if \(!looksCut\(text\)\) return text;/);
  });

  it("embeds through the Bedrock shim at size 1024, charged to the agency (state rules: no agency)", () => {
    const embed = body("embedAll");
    assert.match(
      embed,
      /gatewayEmbeddingsFetch\(\s*\{ input: batch\.map\(\(i\) => inputs\[i\]!\), dimensions: EMBED_DIMENSIONS \},\s*\{ orgId \},?\s*\)/,
    );
    assert.match(embed, /while \(next < queue\.length && Date\.now\(\) < deadline\)/);
    assert.match(
      body("indexStateRuleVersion"),
      /return writeSections\(db, source, text, null, opts\);/,
    );
    assert.match(
      body("indexLibraryVersion"),
      /return writeSections\(db, source, text, doc\.organization_id, opts\);/,
    );
  });

  it("catches up only published, current library documents that have nothing in search", () => {
    const backlog = body("indexLibraryBacklog");
    assert.match(backlog, /\.eq\("library_status", "published"\)/);
    assert.match(backlog, /\.is\("superseded_by", null\)/);
    assert.match(backlog, /\.not\("library_group", "is", null\)/);
    assert.match(backlog, /if \(has\?\.length\) continue;/);
  });

  it("never logs document text", () => {
    assert.doesNotMatch(SRC, /console\./);
    assert.ok(SRC.split("\n").length <= 300);
  });
});
