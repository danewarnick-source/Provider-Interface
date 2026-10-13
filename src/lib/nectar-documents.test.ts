import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./nectar-documents.functions.ts", import.meta.url), "utf8");

function serverFn(name: string): string {
  const start = SRC.indexOf(`export const ${name} = createServerFn`);
  assert.ok(start >= 0, `${name} is still exported`);
  const next = SRC.indexOf("export const ", start + 1);
  return SRC.slice(start, next < 0 ? undefined : next);
}

describe("nectar-documents.functions.ts (N1)", () => {
  it("ingestDocument runs the guarded pipeline and never touches storage itself", () => {
    const ingest = serverFn("ingestDocument");
    assert.match(ingest, /return runIngest\(data, ingestDeps\(supabase, userId, data\.organizationId\)\);/);
    assert.doesNotMatch(ingest, /\.storage/);
    assert.doesNotMatch(ingest, /applyExtractedFieldsToClient|parseDocumentWithAI/);
  });

  it("keeps its exported names and fits the lib size limit", () => {
    for (const name of [
      "ingestDocument",
      "queryDocuments",
      "getDocument",
      "getExtractedFields",
      "reviewExtractedField",
      "deleteDocument",
    ]) {
      serverFn(name);
    }
    assert.ok(SRC.split("\n").length <= 300);
  });
});
