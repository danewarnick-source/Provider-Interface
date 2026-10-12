// Source checks for Option A: on desktop a person profile turns the dark
// main sidebar into its section menu; phones keep the pill row and the
// hamburger drawer keeps the main menu.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("profile sidebar takeover", () => {
  const dash = read("../routes/dashboard.tsx");
  const shell = read("../components/profile-shell/profile-shell.tsx");
  const side = read("../components/profile-shell/profile-sidebar.tsx");
  const take = read("../components/profile-shell/sidebar-takeover.tsx");

  it("the desktop <aside> can be taken over; the phone drawer keeps the main menu", () => {
    assert.match(dash, /<SidebarTakeoverProvider>/);
    assert.match(dash, /md:flex">\s*<DesktopSidebar \{\.\.\.sidebarProps\} \/>/);
    assert.match(dash, /<SidebarBody \{\.\.\.sidebarProps\} onNavigate=\{\(\) => setMobileOpen\(false\)\} \/>/);
    assert.match(dash, /const profile = useSidebarProfile\(\);\s*if \(!profile\) return <SidebarBody \{\.\.\.props\} \/>;/);
    assert.match(dash, /<ProfileSidebar[\s\S]*?<SidebarFooter/, "same user / org / sign-out footer");
  });

  it("the profile sends its menu only on desktop and releases it when it closes", () => {
    assert.match(shell, /const inSidebar = canTakeOver && desktop === true;/);
    assert.match(shell, /useSidebarTakeover\(\s*inSidebar && sidebar/);
    assert.match(shell, /\{inSidebar \? null : \(/, "never both menus in the page");
    assert.match(shell, /canTakeOver && "md:hidden"/, "the white card never shows on desktop");
    assert.match(take, /useEffect\(\(\) => \(\) => set\?\.\(null\), \[set\]\);/);
    assert.match(take, /\(min-width: 768px\)/);
  });

  it("sidebar items keep the test ids, aria-current, visible focus and badges", () => {
    assert.match(side, /data-testid="profile-section-menu"/);
    assert.match(side, /data-testid=\{`profile-section-\$\{s\.key\}`\}/);
    assert.match(side, /aria-current=\{active \? "page" : undefined\}/);
    assert.match(side, /focus-visible:ring-2/);
    assert.match(side, /data-testid="profile-section-badge"/);
    assert.match(side, /active \? "hive-nav-active" : ITEM_IDLE/);
    assert.match(side, /<PiBrand to="\/dashboard"/);
  });

  it("clients and team members pass the back link and the person", () => {
    const client = read("../components/clients/profile/client-profile-page.tsx");
    const member = read("../components/team-members/profile/profile-page.tsx");
    assert.match(client, /label: "All clients"[\s\S]*?onClick: armClientListReturn/);
    assert.match(client, /subline: \[data\.codes\.join\(", "\), data\.home\?\.name\]/);
    assert.match(member, /label: "All team members"[\s\S]*?search: lastRosterSearch\(\)/);
    assert.match(member, /data\.member\.jobTitle\?\.trim\(\)/);
  });
});
