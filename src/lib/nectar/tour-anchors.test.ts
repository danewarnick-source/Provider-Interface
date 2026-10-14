import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { TOUR_ANCHORS, anchorsForPrompt, anchorsForSurface, findAnchor } from "./tour-anchors.ts";

const SRC = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

function sourceFiles(dir = SRC, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const next = join(dir, ent.name);
    if (ent.isDirectory()) sourceFiles(next, out);
    else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) out.push(next);
  }
  return out;
}

const navSlug = (to: string) => `nav.${to.replace(/^\/dashboard\/?/, "") || "home"}`;

/** The `to:` paths of the sidebar arrays (ADMIN_NAV, NECTAR_NAV, STAFF_NAV) in routes/dashboard.tsx. */
function sidebarPaths(source: string): string[] {
  return ["ADMIN_NAV", "NECTAR_NAV", "STAFF_NAV"].flatMap((name) => {
    const start = source.indexOf(`const ${name}: NavItem[] = [`);
    if (start < 0) return [];
    const block = source.slice(start, source.indexOf("];", start));
    return [...block.matchAll(/\{\s*to:\s*"([^"]+)"/g)].map((m) => m[1]!);
  });
}

/** Every data-tour value an element can carry: literal attributes plus sidebar and bottom-tab slugs. */
function dataTourIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of sourceFiles()) {
    for (const m of readFileSync(file, "utf8").matchAll(/data-tour="([^"]+)"/g)) ids.add(m[1]);
  }
  const paths = sidebarPaths(read("routes/dashboard.tsx"));
  assert.ok(paths.length > 10, "the sidebar arrays were found");
  for (const path of paths) ids.add(navSlug(path));
  const tabs = read("components/staff-mobile/staff-bottom-tabs.tsx");
  const start = tabs.indexOf("const TABS: StaffTab[] = [");
  for (const m of tabs.slice(start, tabs.indexOf("];", start)).matchAll(/to: "([^"]+)"/g)) {
    ids.add(navSlug(m[1]));
  }
  return ids;
}

describe("tour anchors (N2)", () => {
  it("derives sidebar and bottom-tab ids the same way the components do", () => {
    assert.ok(
      read("routes/dashboard.tsx").includes(
        'const slug = item.to.replace(/^\\/dashboard\\/?/, "") || "home";',
      ),
    );
    assert.ok(read("routes/dashboard.tsx").includes("data-tour={`nav.${slug}`}"));
    assert.ok(
      read("components/staff-mobile/staff-bottom-tabs.tsx").includes(
        'data-tour={`nav.${t.to.replace(/^\\/dashboard\\/?/, "") || "home"}`}',
      ),
    );
  });

  it("only lists anchors that match a data-tour element", () => {
    const ids = dataTourIds();
    for (const anchor of TOUR_ANCHORS) assert.ok(ids.has(anchor.id), anchor.id);
  });

  it("has unique ids and real routes", () => {
    const ids = TOUR_ANCHORS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    const tree = read("routeTree.gen.ts");
    const start = tree.indexOf("export interface FileRoutesByFullPath {");
    const byFullPath = tree.slice(start, tree.indexOf("\n}", start));
    for (const a of TOUR_ANCHORS) {
      assert.ok(
        byFullPath.includes(`'${a.route}':`) || byFullPath.includes(`'${a.route}/':`),
        a.route,
      );
    }
  });

  it("keeps the lookups the guided tour uses", () => {
    assert.equal(findAnchor("nav.help")?.route, "/dashboard/help");
    assert.equal(findAnchor("nav.not-a-real-anchor"), undefined);
    assert.ok(anchorsForSurface("staff").every((a) => a.surface !== "admin"));
    assert.ok(anchorsForSurface("admin").every((a) => a.surface !== "staff"));
    assert.match(anchorsForPrompt("staff"), /^- nav\.home \(\/dashboard\) — /);
  });
});
