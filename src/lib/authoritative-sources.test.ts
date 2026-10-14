import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./authoritative-sources.functions.ts", import.meta.url), "utf8");

describe("authoritative-sources.functions.ts (N2, N4)", () => {
  it("keeps only the exports live screens import", () => {
    const exported = [...SRC.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
    // N4: ingestWebSource and listAuthoritativeSources went with the old Knowledge page.
    assert.deepEqual(exported, [
      "markAsAuthoritativeSource",
      "recordAttestation",
      "REDUCED_LIABILITY_NOTICE",
    ]);
    assert.ok(SRC.split("\n").length <= 300);
  });

  it("no longer drafts, approves or explains requirements, or captures web pages", () => {
    assert.doesNotMatch(SRC, /from\("nectar_requirements"\)|from\("nectar_draft_jobs"\)/);
    assert.doesNotMatch(SRC, /fetch\(|stripHtmlToText/);
    const imports = [...SRC.matchAll(/(?:from|import\() "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(imports, [
      "@tanstack/react-start",
      "zod",
      "@/integrations/supabase/auth-middleware",
      "@/integrations/supabase/require-org",
      "@/lib/nectar/library/library",
      "./authoritative-sources.server",
    ]);
  });
});

describe("Knowledge base uploads land in the library (N3)", () => {
  function fn(name: string): string {
    const start = SRC.indexOf(`export const ${name} = createServerFn`);
    assert.ok(start >= 0, name);
    return SRC.slice(start, SRC.indexOf("export const ", start + 1));
  }

  it("a marked company upload gets the library group for its kind (Policy / procedure -> agency)", () => {
    const mark = fn("markAsAuthoritativeSource");
    assert.match(mark, /\.select\("organization_id, owner_kind"\)/);
    assert.match(
      mark,
      /if \(data\.isAuthoritative && docRow\.owner_kind === "company"\) \{\s*update\.library_group = libraryGroupForKind\(data\.authoritativeKind\);/,
    );
  });
});
