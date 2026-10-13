import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { HELP_LINK_ROUTES, helpDeepLink, realHelpPath } from "./help-links.ts";
import { sidebarNav } from "./nav-map.ts";

const ID = "2b7c9e4a-1f3d-4c8b-9a6e-5d4c3b2a1f0e";

describe("realHelpPath", () => {
  it("keeps real admin screens, with simple query strings", () => {
    assert.equal(realHelpPath("/dashboard/billing"), "/dashboard/billing");
    assert.equal(realHelpPath("/dashboard"), "/dashboard");
    assert.equal(realHelpPath("/dashboard/compliance?tab=staff"), "/dashboard/compliance?tab=staff");
    assert.equal(realHelpPath("/dashboard/hub/knowledge"), "/dashboard/hub/knowledge");
    assert.equal(realHelpPath("/dashboard/team-members/"), "/dashboard/team-members");
    assert.equal(realHelpPath("/dashboard/team-members"), "/dashboard/team-members");
  });

  it("accepts a dynamic screen only with a real id", () => {
    assert.equal(realHelpPath(`/dashboard/billing/${ID}`), `/dashboard/billing/${ID}`);
    assert.equal(
      realHelpPath(`/dashboard/team-members/${ID}?tab=caseload`),
      `/dashboard/team-members/${ID}?tab=caseload`,
    );
    assert.equal(realHelpPath("/dashboard/billing/$clientId"), null);
    assert.equal(realHelpPath("/dashboard/team-members/<id>?tab=caseload"), null);
    assert.equal(realHelpPath("/dashboard/clients/not-an-id"), null);
  });

  it("drops screens that don't exist and anything that leaves the app", () => {
    for (const bad of [
      "/dashboard/made-up-screen",
      "/dashboard/authoritative-sources",
      "/admin",
      "dashboard/billing",
      "//evil.example/dashboard",
      "https://evil.example/dashboard",
      "javascript:alert(1)",
      "/dashboard/billing#top",
      "/dashboard/billing?tab=<x>",
      "/dashboard/billing?a=1?b=2",
      "/dashboard/billing\\..",
      "",
      42,
      null,
      undefined,
    ]) {
      assert.equal(realHelpPath(bad), null, String(bad));
    }
  });
});

describe("helpDeepLink", () => {
  it("keeps a real link and defaults a blank label", () => {
    assert.deepEqual(helpDeepLink({ path: "/dashboard/billing/nectar", label: "Open the report builder" }), {
      path: "/dashboard/billing/nectar",
      label: "Open the report builder",
    });
    assert.deepEqual(helpDeepLink({ path: "/dashboard/billing", label: "  " }), {
      path: "/dashboard/billing",
      label: "Take me there",
    });
  });

  it("drops a fake link instead of sending it somewhere else", () => {
    assert.equal(helpDeepLink({ path: "/dashboard/billing/$clientId", label: "Billing" }), null);
    assert.equal(helpDeepLink(null), null);
    assert.equal(helpDeepLink("/dashboard/billing"), null);
  });
});

describe("HELP_LINK_ROUTES", () => {
  it("lists only routes in the generated route tree", () => {
    const tree = readFileSync(new URL("../../routeTree.gen.ts", import.meta.url), "utf8");
    const start = tree.indexOf("export interface FileRoutesByFullPath {");
    const byFullPath = tree.slice(start, tree.indexOf("\n}", start));
    for (const route of HELP_LINK_ROUTES) {
      assert.ok(byFullPath.includes(`'${route}':`), route);
    }
  });

  it("accepts every screen in the real sidebar, so any path in the help map can be a link (N2)", () => {
    const nav = sidebarNav(
      readFileSync(new URL("../../routes/dashboard.tsx", import.meta.url), "utf8"),
    );
    const paths = [...nav.admin, ...nav.nectar, ...nav.staff].map((link) => link.path);
    assert.ok(paths.length >= 20, "sidebar read");
    for (const path of paths) assert.equal(realHelpPath(path), path, path);
  });
});
