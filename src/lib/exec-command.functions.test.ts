import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const SRC = read("./exec-command.functions.ts");
const LANDING = read("../components/hive-exec/command/command-landing.tsx");

describe("exec Needs-you summary (N2)", () => {
  it("no longer counts requirement extraction approvals", () => {
    assert.doesNotMatch(SRC, /extraction_approvals|nectar_requirements/);
    assert.doesNotMatch(LANDING, /extraction_approvals|hive-exec\/approvals/);
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
