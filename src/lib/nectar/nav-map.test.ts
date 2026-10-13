import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ADMIN_PRIMARY_NAV_LABELS } from "../compliance-nav.ts";
import { navEntries, navMapForPrompt, sidebarNav } from "./nav-map.ts";

const DASHBOARD = readFileSync(new URL("../../routes/dashboard.tsx", import.meta.url), "utf8");

const SAMPLE = `
const ADMIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  {
    to: "/dashboard/team-members",
    label: "Team Members",
    icon: Users,
  },
];
const NECTAR_NAV: NavItem[] = [
  { to: "/dashboard/help", label: "Nectar", icon: HelpCircle, feature: "nectar" },
];
`;

describe("navEntries", () => {
  it("reads single-line and multi-line entries in order", () => {
    assert.deepEqual(navEntries(SAMPLE, "ADMIN_NAV"), [
      { path: "/dashboard", label: "Home" },
      { path: "/dashboard/team-members", label: "Team Members" },
    ]);
    assert.deepEqual(navEntries(SAMPLE, "NECTAR_NAV"), [{ path: "/dashboard/help", label: "Nectar" }]);
  });

  it("returns nothing for an array that is not there", () => {
    assert.deepEqual(navEntries(SAMPLE, "STAFF_NAV"), []);
  });
});

describe("sidebarNav on the real routes/dashboard.tsx", () => {
  const nav = sidebarNav(DASHBOARD);

  it("reads the twelve admin items in sidebar order", () => {
    assert.deepEqual(
      nav.admin.map((link) => link.label),
      [...ADMIN_PRIMARY_NAV_LABELS],
    );
  });

  it("reads the Nectar cluster and the team member sidebar", () => {
    assert.deepEqual(nav.nectar, [
      { path: "/dashboard/help", label: "Nectar" },
      { path: "/dashboard/hub/knowledge", label: "Knowledge base" },
    ]);
    assert.deepEqual(nav.staff[0], { path: "/dashboard", label: "My Caseload" });
    assert.ok(nav.staff.some((link) => link.path === "/dashboard/ask-nectar"));
  });

  it("picks up every entry of each array", () => {
    for (const name of ["ADMIN_NAV", "NECTAR_NAV", "STAFF_NAV"]) {
      const start = DASHBOARD.indexOf(`const ${name}: NavItem[] = [`);
      assert.ok(start >= 0, name);
      const block = DASHBOARD.slice(start, DASHBOARD.indexOf("];", start));
      assert.equal(navEntries(DASHBOARD, name).length, block.match(/\bto: "/g)?.length, name);
    }
  });
});

describe("navMapForPrompt", () => {
  it("lists the admin sidebar with Nectar, then the team member sidebar", () => {
    const map = navMapForPrompt(sidebarNav(DASHBOARD));
    assert.match(map, /^PI NAVIGATION MAP — the real sidebar/);
    assert.match(map, /ADMIN SIDEBAR:\n- \/dashboard — Home\n/);
    assert.match(map, /\n- \/dashboard\/team-members — Team Members\n/);
    assert.match(map, /\n- \/dashboard\/hub\/knowledge — Knowledge base\n\nTEAM MEMBER SIDEBAR/);
    assert.match(map, /TEAM MEMBER SIDEBAR \(what staff see\):\n- \/dashboard — My Caseload\n/);
  });
});
