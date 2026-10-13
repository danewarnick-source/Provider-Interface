import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./library-files.server.ts", import.meta.url), "utf8");

describe("library-files.server.ts (N3)", () => {
  it("only accepts an uploaded path from this agency's library folder", () => {
    assert.match(SRC, /if \(!isLibraryPathForOrg\(upload\.path, orgId\)\) \{/);
  });

  it("saves typed text as the version's .txt file so every version has a file", () => {
    assert.match(SRC, /const size = await storeTypedText\(db, path, clean\);/);
    assert.match(SRC, /mime_type: "text\/plain"/);
    assert.match(SRC, /parse_status: clean \? "parsed" : "no_text"/);
  });

  it("reads an uploaded file's text after the row exists, and a file it can't open is 'failed'", () => {
    assert.match(SRC, /const bytes = await readStoredFile\(db, file\.storage_path\);/);
    assert.match(SRC, /parse_status: "failed",/);
    assert.doesNotMatch(SRC, /console\.|\.delete\(|\.remove\(/);
  });
});
