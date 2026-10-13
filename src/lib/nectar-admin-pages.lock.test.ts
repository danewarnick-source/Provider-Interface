import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isLevelAtLeast } from "./access/levels.ts";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const ADMIN_PAGES: Record<string, string> = {
  "/dashboard/help": "../routes/dashboard.help.tsx",
  "/dashboard/hub/knowledge": "../routes/dashboard.hub.knowledge.tsx",
  "/dashboard/nectar-docs": "../routes/dashboard.nectar-docs.tsx",
};

const GATE = /<RequireLevel min="admin" redirectTo="\/dashboard\/ask-nectar">/;

describe("Nectar admin pages (N1 route guards)", () => {
  it("each requires admin level and keeps the nectar feature gate", () => {
    for (const [path, file] of Object.entries(ADMIN_PAGES)) {
      const src = read(file);
      assert.match(src, GATE, `${path} is wrapped in the admin gate`);
      assert.match(src, /featureKey="nectar"/, `${path} keeps the feature gate`);
      assert.match(src, /import \{ RequireLevel \} from "@\/components\/rbac-guard"/, path);
    }
  });

  it("the level check refuses a team member and lets owners and admins in", () => {
    assert.equal(isLevelAtLeast("staff", "admin"), false);
    assert.equal(isLevelAtLeast(null, "admin"), false);
    assert.equal(isLevelAtLeast("admin", "admin"), true);
    assert.equal(isLevelAtLeast("owner", "admin"), true);
  });

  it("RequireLevel sends a blocked member to redirectTo, replacing the URL", () => {
    const guard = read("../components/rbac-guard.tsx");
    assert.match(guard, /useGate\(isLevelAtLeast\(level, min\), isLoading, undefined, redirectTo\)/);
    assert.match(guard, /if \(redirectTo\) \{\s*navigate\(\{ to: redirectTo, replace: true \}\);\s*return;/);
    assert.match(guard, /type GateRedirect = "\/dashboard\/ask-nectar"/);
  });

  it("the help page only mounts inside the gate", () => {
    const help = read("../routes/dashboard.help.tsx");
    assert.match(help, /component: HelpRoute/);
    assert.match(help, /<RequireLevel min="admin" redirectTo="\/dashboard\/ask-nectar">\s*<HelpPage \/>/);
    assert.doesNotMatch(help, /STARTERS_STAFF/);
  });
});
