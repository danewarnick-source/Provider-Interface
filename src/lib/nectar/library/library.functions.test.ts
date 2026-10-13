import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./library.functions.ts", import.meta.url), "utf8");

function serverFn(name: string): string {
  const start = SRC.indexOf(`export const ${name} = createServerFn`);
  assert.ok(start >= 0, `${name} is exported`);
  const next = SRC.indexOf("export const ", start + 1);
  return SRC.slice(start, next < 0 ? undefined : next);
}

const ADMIN_READS = ["listLibrary", "getLibraryDocument", "getRequiredPolicies", "getReviewMatrix"];
const ADMIN_WRITES = [
  "createLibraryDraft",
  "saveLibraryDraft",
  "publishLibraryDocument",
  "publishLibraryVersion",
  "archiveLibraryDocument",
  "setLibraryAudience",
  "setRequiredPolicyAnswers",
  "refreshKnowledgeSearch",
];
const MEMBER_CALLS = ["getPolicyForReview", "markPolicyReviewed"];

describe("library.functions.ts (N3)", () => {
  it("exports the library server functions N4 and N6 call, and nothing else", () => {
    const exported = [...SRC.matchAll(/^export const (\w+) = createServerFn/gm)].map((m) => m[1]);
    assert.deepEqual(
      exported.sort(),
      [...ADMIN_READS, ...ADMIN_WRITES, ...MEMBER_CALLS, "getStaffReviewRecord"].sort(),
    );
  });

  it("every function runs behind the auth middleware and validates its input", () => {
    for (const name of [...ADMIN_READS, ...ADMIN_WRITES, ...MEMBER_CALLS, "getStaffReviewRecord"]) {
      const fn = serverFn(name);
      assert.match(fn, /\.middleware\(\[requireSupabaseAuth\]\)/, name);
      assert.match(fn, /\.inputValidator\(\(input: unknown\) => \w+\.parse\(input\)\)/, name);
    }
  });

  it("admin reads need agency_settings view, admin writes need edit, both checked first", () => {
    for (const name of ADMIN_READS) {
      assert.match(
        serverFn(name),
        /await requireLibraryAdmin\(context, data\.organizationId, "view"\)/,
        name,
      );
    }
    for (const name of ADMIN_WRITES) {
      assert.match(
        serverFn(name),
        /await requireLibraryAdmin\(context, data\.organizationId, "edit"\)/,
        name,
      );
    }
  });

  it("Mark as reviewed and a team member's own policies need only an active membership", () => {
    for (const name of MEMBER_CALLS) {
      assert.match(
        serverFn(name),
        /await requireLibraryMember\(context, data\.organizationId\)/,
        name,
      );
    }
    const record = serverFn("getStaffReviewRecord");
    assert.match(record, /const self = !data\.userId \|\| data\.userId === context\.userId;/);
    assert.match(
      record,
      /\? await requireLibraryMember\(context, data\.organizationId\)\s*: await requireLibraryAdmin\(context, data\.organizationId, "view"\)/,
    );
  });

  it("reads and writes on the caller's own client, never the service role", () => {
    assert.doesNotMatch(SRC, /supabaseAdmin|client\.server/);
    assert.ok(SRC.split("\n").length <= 300);
  });
});
