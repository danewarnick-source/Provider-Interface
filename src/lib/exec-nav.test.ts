import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const NAV = read("./exec-nav.ts");

describe("exec nav (N2)", () => {
  it("links only to routes in the generated route tree", () => {
    const tree = read("../routeTree.gen.ts");
    const start = tree.indexOf("export interface FileRoutesByFullPath {");
    const byFullPath = tree.slice(start, tree.indexOf("\n}", start));
    const targets = [...NAV.matchAll(/to: "([^"]+)"/g)].map((m) => m[1]);
    assert.ok(targets.length > 10, "exec nav targets found");
    for (const to of targets) {
      assert.ok(byFullPath.includes(`'${to}':`) || byFullPath.includes(`'${to}/':`), to);
    }
  });

  it("drops the requirement extraction approval queue and keeps billing approvals", () => {
    assert.doesNotMatch(NAV, /hive-exec\/approvals|Extraction Approvals|extraction\.approve/);
    assert.match(NAV, /to: "\/dashboard\/hive-exec\/billing-approvals"/);
  });
});
