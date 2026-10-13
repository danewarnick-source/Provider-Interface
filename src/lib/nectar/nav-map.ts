// The admin help prompt's map of PI screens, read from the real sidebar
// arrays in routes/dashboard.tsx (ADMIN_NAV, NECTAR_NAV, STAFF_NAV) so it
// cannot drift from what people see. Nothing is copied: the caller passes
// that file's source text (nectar-help.functions.ts imports it with ?raw,
// because dashboard.tsx is shared and does not export the arrays).

export type SidebarLink = { path: string; label: string };
export type SidebarNav = { admin: SidebarLink[]; nectar: SidebarLink[]; staff: SidebarLink[] };

const ENTRY_RE = /\{\s*to:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g;

/** The `{ to, label }` entries of `const <name>: NavItem[] = [ ... ];` in the dashboard source. */
export function navEntries(source: string, name: string): SidebarLink[] {
  const start = source.indexOf(`const ${name}: NavItem[] = [`);
  if (start < 0) return [];
  const block = source.slice(start, source.indexOf("];", start));
  return [...block.matchAll(ENTRY_RE)].map((m) => ({ path: m[1], label: m[2] }));
}

export function sidebarNav(dashboardSource: string): SidebarNav {
  return {
    admin: navEntries(dashboardSource, "ADMIN_NAV"),
    nectar: navEntries(dashboardSource, "NECTAR_NAV"),
    staff: navEntries(dashboardSource, "STAFF_NAV"),
  };
}

function lines(links: SidebarLink[]): string {
  return links.map((link) => `- ${link.path} — ${link.label}`).join("\n");
}

/** The map block for the help prompt: admin sidebar (with Nectar) and the team member sidebar. */
export function navMapForPrompt(nav: SidebarNav): string {
  return `PI NAVIGATION MAP — the real sidebar (use these paths verbatim; never invent screens):

ADMIN SIDEBAR:
${lines([...nav.admin, ...nav.nectar])}

TEAM MEMBER SIDEBAR (what staff see):
${lines(nav.staff)}`;
}
