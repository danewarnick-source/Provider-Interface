import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./uploads.functions.ts", import.meta.url), "utf8");

describe("uploads.functions.ts (N3)", () => {
  it("hands out a signed upload URL only to an owner or agency-wide admin, before touching storage", () => {
    const guard = SRC.indexOf('await requireLibraryAdmin(context, data.organizationId, "edit")');
    const storage = SRC.indexOf(".createSignedUploadUrl(path)");
    assert.ok(guard > 0 && storage > guard);
    assert.ok(SRC.indexOf("uploadProblem(data)") > guard, "file type and size are checked too");
  });

  it("puts the file under the agency's library folder in the nectar-documents bucket", () => {
    assert.match(
      SRC,
      /const path = libraryObjectPath\(orgId, data\.fileName, crypto\.randomUUID\(\)\);/,
    );
    assert.match(SRC, /\.from\(LIBRARY_BUCKET\)/);
    assert.match(SRC, /return \{ path, token: signed\.token, signedUrl: signed\.signedUrl \};/);
  });

  it("never takes the file itself (no base64 through a server function)", () => {
    const code = SRC.split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    assert.doesNotMatch(code, /base64|atob\(/i);
    assert.deepEqual(
      [...SRC.matchAll(/^export const (\w+)/gm)].map((m) => m[1]),
      ["createLibraryUploadUrl"],
    );
  });
});
