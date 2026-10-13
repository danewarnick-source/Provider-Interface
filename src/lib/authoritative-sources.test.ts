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

describe("authoritative-sources.functions.ts (N2)", () => {
  it("keeps only the exports live screens import", () => {
    const exported = [...SRC.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
    assert.deepEqual(exported, [
      "ingestWebSource",
      "listAuthoritativeSources",
      "markAsAuthoritativeSource",
      "recordAttestation",
      "REDUCED_LIABILITY_NOTICE",
    ]);
    assert.ok(SRC.split("\n").length <= 300);
  });

  it("no longer drafts, approves or explains requirements", () => {
    assert.doesNotMatch(SRC, /from\("nectar_requirements"\)|from\("nectar_draft_jobs"\)/);
    const imports = [...SRC.matchAll(/(?:from|import\() "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(imports, [
      "@tanstack/react-start",
      "zod",
      "@/integrations/supabase/auth-middleware",
      "@/integrations/supabase/require-org",
      "./authoritative-sources.server",
    ]);
  });
});
