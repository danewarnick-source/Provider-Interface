import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./state-rules.functions.ts", import.meta.url), "utf8");

function serverFn(name: string): string {
  const start = SRC.indexOf(`export const ${name} = createServerFn`);
  assert.ok(start >= 0, `${name} is exported`);
  const next = SRC.indexOf("export const ", start + 1);
  return SRC.slice(start, next < 0 ? undefined : next);
}

const FUNCTIONS = [
  "listStateRules",
  "createStateRuleUploadUrl",
  "publishStateRuleVersion",
  "refreshStateRuleSearch",
];

describe("state-rules.functions.ts (N4 exec State rules)", () => {
  it("exports the four functions the exec State rules section calls, and nothing else", () => {
    const exported = [...SRC.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
    assert.deepEqual(exported, FUNCTIONS);
  });

  it("every function runs behind the auth middleware and checks for a hive executive first", () => {
    for (const name of FUNCTIONS) {
      const fn = serverFn(name);
      assert.match(fn, /\.middleware\(\[requireSupabaseAuth\]\)/, name);
      assert.match(fn, /await requireHiveExecutive\(context\)/, name);
    }
  });

  it("validates every input that comes from the screen", () => {
    assert.match(
      serverFn("createStateRuleUploadUrl"),
      /\.inputValidator\(\(input: unknown\) => StateRuleUploadUrlInput\.parse\(input\)\)/,
    );
    assert.match(
      serverFn("publishStateRuleVersion"),
      /\.inputValidator\(\(input: unknown\) => PublishStateRuleInput\.parse\(input\)\)/,
    );
    assert.match(
      serverFn("refreshStateRuleSearch"),
      /\.inputValidator\(\(input: unknown\) => StateRuleIdInput\.parse\(input\)\)/,
    );
  });

  it("works on the executive's own client, never the service role, and takes no file bytes", () => {
    assert.doesNotMatch(SRC, /supabaseAdmin|client\.server|base64/);
    assert.ok(SRC.split("\n").length <= 300);
  });
});
