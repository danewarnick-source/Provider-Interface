import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./library-data.server.ts", import.meta.url), "utf8");

describe("library-data.server.ts (N3)", () => {
  it("reads team members and their names in two queries, joined in code (no embed)", () => {
    assert.match(SRC, /\.from\("organization_members"\)\s*\.select\("user_id"\)/);
    assert.match(SRC, /\.from\("profiles"\)\.select\("id, full_name, email"\)\.in\("id", ids\)/);
    assert.doesNotMatch(SRC, /profiles\(|organization_members\(/);
    assert.match(SRC, /\.eq\("active", true\)/);
  });

  it("pages review rows past the 1,000-row cap and in id batches", () => {
    assert.match(SRC, /for \(let i = 0; i < docIds\.length; i \+= 100\)/);
    assert.match(SRC, /\.order\("id"\)\.range\(from, from \+ 999\)/);
    assert.match(SRC, /if \(\(data \?\? \[\]\)\.length < 1000\) break;/);
  });

  it("lists only current versions of company library documents", () => {
    assert.match(SRC, /\.eq\("owner_kind", "company"\)/);
    assert.match(SRC, /\.not\("library_group", "is", null\)/);
    assert.match(SRC, /\.is\("superseded_by", null\)/);
  });

  it("hands out 30-minute file links only through storage's own read check", () => {
    assert.match(SRC, /createSignedUrl\(path, 60 \* 30\)/);
    assert.doesNotMatch(SRC, /supabaseAdmin/);
  });
});
