import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./authoritative-sources.functions.ts", import.meta.url), "utf8");

describe("listAuthoritativeSources (N1)", () => {
  it("checks org membership on the server before reading, as a second layer to RLS", () => {
    const start = SRC.indexOf("export const listAuthoritativeSources = createServerFn");
    assert.ok(start >= 0);
    const fn = SRC.slice(start, SRC.indexOf("export const ", start + 1));
    assert.match(fn, /if \(!supabase \|\| !userId\) return \{ sources: \[\] \};/);
    const check = fn.indexOf("await requireOrgMembership(supabase, userId, data.organizationId);");
    assert.ok(check > 0 && check < fn.indexOf('.from("nectar_documents")'), "membership before the read");
    assert.match(fn, /\.in\("owner_kind", \["company", "state"\]\)/);
  });
});
