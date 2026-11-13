// B1 done-when: the DSI-hours rule is gone, and nothing in src/ reads
// scheduled_shifts.job_code or the legacy locations table any more.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../../", import.meta.url));
const THIS = fileURLToPath(import.meta.url);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const rel = (p: string) => p.slice(SRC.length);

// Generated types, plus two things that only share the name: an agency policy's
// "job code" audience (agency_policies.audience_kind) and the clients.job_code
// legacy column named in a comment that lists retired client fields.
const JOB_CODE_OK = new Set([
  "integrations/supabase/types.ts",
  "lib/agency-policies.ts",
  "lib/agency-policies.test.ts",
  "lib/agency-policies.functions.ts",
  "components/agency-documents/company-policies-tab.tsx",
  "lib/clients/legacy-fields.ts",
]);

test("rules-warn.test.ts has no DSI-hours case and the rule is gone", () => {
  const dir = fileURLToPath(new URL("./", import.meta.url));
  assert.doesNotMatch(
    readFileSync(join(dir, "rules-warn.test.ts"), "utf8"),
    /dsi_over_6h|DSI over 6/,
  );
  for (const f of files(dir).filter((p) => p !== THIS))
    assert.doesNotMatch(readFileSync(f, "utf8"), /dsi_over_6h|dsiHoursRule/, rel(f));
});

test("a grep for job_code in src/ returns only types (and the two unrelated names)", () => {
  const hits = files(SRC).filter(
    (p) => p !== THIS && !JOB_CODE_OK.has(rel(p)) && /\bjob_code\b/.test(readFileSync(p, "utf8")),
  );
  assert.deepEqual(hits.map(rel), []);
});

test("a grep for from('locations') in src/ returns nothing", () => {
  const hits = files(SRC).filter(
    (p) => p !== THIS && /\.from\(\s*["'`]locations["'`]\s*\)/.test(readFileSync(p, "utf8")),
  );
  assert.deepEqual(hits.map(rel), []);
});

test("the old per-path scheduler checks are deleted", () => {
  const names = new Set(files(SRC).map(rel));
  for (const f of [
    "client-codes.functions.ts",
    "eligibility.functions.ts",
    "required-qualifications.functions.ts",
    "shift-checks.ts",
    "shift-commit.ts",
    "shifts.functions.ts",
    "locations.functions.ts",
  ]) {
    assert.ok(!names.has(`lib/scheduler/${f}`), f);
  }
});
