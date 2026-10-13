import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const SRC = read("./exec-command.functions.ts");
const LANDING = read("../components/hive-exec/command/command-landing.tsx");

describe("exec Needs-you summary (N2)", () => {
  it("counts four queues and no longer reads requirements", () => {
    const start = SRC.indexOf("export interface NeedsYouSummary {");
    const block = SRC.slice(start, SRC.indexOf("}", start));
    const keys = [...block.matchAll(/^\s+(\w+): number;/gm)].map((m) => m[1]);
    assert.deepEqual(keys, [
      "upgrade_requests",
      "billing_approvals",
      "functionality_reports",
      "agreements_attention",
    ]);
    assert.doesNotMatch(SRC, /nectar_requirements/);
  });

  it("links each Needs-you row to a queue that still exists", () => {
    const targets = [...LANDING.matchAll(/<NeedsRow\s+to="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(targets, [
      "/dashboard/hive-exec/upgrade-requests",
      "/dashboard/hive-exec/billing-approvals",
      "/dashboard/hive-exec/functionality",
      "/dashboard/hive-exec/agreements",
    ]);
  });

  it("still counts and shows the other four queues", () => {
    for (const key of [
      "upgrade_requests",
      "billing_approvals",
      "functionality_reports",
      "agreements_attention",
    ]) {
      assert.match(SRC, new RegExp(`${key}: \\w+\\.count \\?\\? 0`), key);
      assert.match(LANDING, new RegExp(`n\\?\\.${key}`), key);
    }
  });
});
