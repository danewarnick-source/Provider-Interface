import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./library-write.server.ts", import.meta.url), "utf8");

function body(name: string): string {
  const start = SRC.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is exported`);
  const next = SRC.indexOf("export ", start + 1);
  return SRC.slice(start, next < 0 ? undefined : next);
}

describe("library-write.server.ts (N3)", () => {
  it("a new document is a Draft in the group picked, filed under that group (the type mapping fix)", () => {
    const create = body("createDraft");
    assert.match(create, /library_group: input\.group,/);
    assert.match(create, /library_status: "draft",/);
    assert.match(create, /authoritative_kind: authoritativeKindForGroup\(input\.group\),/);
    assert.match(create, /owner_kind: "company",/);
  });

  it("Add to library resolves the question it came from", () => {
    assert.match(
      body("createDraft"),
      /\.from\("nectar_questions"\)\s*\.update\(\{ status: "resolved"/,
    );
  });

  it("only a draft can be edited", () => {
    assert.match(body("saveDraft"), /if \(doc\.library_status !== "draft"\) \{/);
  });

  it("who it's for keeps only active members of the agency", () => {
    const audience = body("setAudience");
    assert.match(
      audience,
      /audienceColumns\(audienceAll \? \{ all: true \} : \{ all: false, userIds \}, memberIds\)/,
    );
    assert.match(audience, /\(await activeMembers\(db, orgId\)\)\.map\(\(m\) => m\.userId\)/);
  });

  it("the agency answers change only the two Required policies columns", () => {
    const toggles = body("setAgencyToggles");
    assert.match(
      toggles,
      /\.from\("organizations"\)\s*\.update\(patch\)\s*\.eq\("id", caller\.orgId\)/,
    );
    assert.match(
      toggles,
      /const patch: \{ provides_transportation\?: boolean; manages_client_money\?: boolean \} = \{\};/,
    );
  });

  it("never deletes a document, and reads only this agency's library rows", () => {
    assert.doesNotMatch(SRC, /\.delete\(|\.remove\(/);
    assert.match(
      body("loadDoc"),
      /\.eq\("organization_id", orgId\)\s*\.eq\("owner_kind", "company"\)\s*\.not\("library_group", "is", null\)/,
    );
  });
});
