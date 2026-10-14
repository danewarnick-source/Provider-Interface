import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./admin.functions.ts", import.meta.url), "utf8");

function serverFn(name: string): string {
  const start = SRC.indexOf(`export const ${name} = createServerFn`);
  assert.ok(start >= 0, `${name} is exported`);
  const next = SRC.indexOf("\nexport const ", start + 1);
  return SRC.slice(start, next < 0 ? undefined : next);
}

function guard(): string {
  const start = SRC.indexOf("async function requireNectarAdmin(");
  assert.ok(start >= 0, "requireNectarAdmin exists");
  return SRC.slice(start, SRC.indexOf("\n}\n", start));
}

const READS = ["listNectarQuestions", "countOpenNectarQuestions", "getNectarSettings"];
const WRITES = ["setNectarQuestionStatus", "saveNectarSettings"];

describe("admin.functions.ts (N6 guards)", () => {
  it("exports the Questions and AI settings functions, and nothing else", () => {
    const exported = [...SRC.matchAll(/^export const (\w+) = createServerFn/gm)].map((m) => m[1]);
    assert.deepEqual(exported.sort(), [...READS, ...WRITES].sort());
  });

  it("every function runs behind the auth middleware and validates its input", () => {
    for (const name of [...READS, ...WRITES]) {
      const fn = serverFn(name);
      assert.match(fn, /\.middleware\(\[requireSupabaseAuth\]\)/, name);
      assert.match(fn, /\.inputValidator\(\(input: unknown\) => \w+\.parse\(input\)\)/, name);
    }
  });

  it("the guard: signed in, Nectar on for the agency, agency_settings at the asked level, agency-wide", () => {
    const g = guard();
    const steps = [
      "if (!context.supabase || !context.userId) throw new Error(NECTAR_REFUSAL_MESSAGE.signed_out)",
      "await requireNectarOrg(context, { orgId, feature: null })",
      'await requireCategory(db, userId, orgId, "agency_settings", min)',
      "if (!isAgencyAdmin(access.level, access.scope)) throw new Error(NECTAR_ADMIN_ONLY)",
    ];
    let at = -1;
    for (const step of steps) {
      const next = g.indexOf(step);
      assert.ok(next > at, `${step} runs in order`);
      at = next;
    }
  });

  it("reads need View and writes need Edit, checked before anything else", () => {
    for (const name of READS) {
      const fn = serverFn(name);
      const check = fn.indexOf('await requireNectarAdmin(context, data.organizationId, "view")');
      assert.ok(check > 0, name);
      assert.ok(check < fn.indexOf("caller.db"), `${name}: guard before the read`);
    }
    for (const name of WRITES) {
      const fn = serverFn(name);
      const check = fn.indexOf('await requireNectarAdmin(context, data.organizationId, "edit")');
      assert.ok(check > 0, name);
      assert.ok(check < fn.indexOf("caller.db"), `${name}: guard before the write`);
    }
  });

  it("no model call, so no AI setting gates it: AI settings stay reachable with Nectar off", () => {
    assert.doesNotMatch(SRC, /feature: "(ask|note_help|pcsp_reading|summary_drafts)"/);
    assert.doesNotMatch(SRC, /gatewayFetch|gatewayEmbeddingsFetch|nectar_infusion/);
  });

  it("works on the caller's own client for the agency asked about; never logs", () => {
    assert.doesNotMatch(SRC, /supabaseAdmin|client\.server/);
    assert.doesNotMatch(SRC, /console\./);
    assert.match(serverFn("listNectarQuestions"), /listQuestions\(caller\.db, caller\.orgId,/);
    assert.match(serverFn("saveNectarSettings"), /saveSettings\(caller\.db, caller\.orgId, data\)/);
    assert.ok(SRC.split("\n").length <= 300);
  });
});
