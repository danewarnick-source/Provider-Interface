import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Team Members lives at /dashboard/team-members. The old employees addresses
 * survive only as permanent redirect routes (saved notifications and emails
 * still carry them), so nothing else in src may link to them.
 */
const SRC = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

const LEGACY_ROUTE_FILES = new Set([
  "routes/dashboard.employees.index.tsx",
  "routes/dashboard.employees.$staffId.tsx",
  "routes/dashboard.employees.new.tsx",
  "routes/dashboard.employees.hire-dates.tsx",
  "routes/dashboard.hub.employees.tsx",
  "routes/employees.tsx",
  "routes/employees.index.tsx",
  "routes/employees.new.tsx",
]);

function sourceFiles(dir = SRC, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const next = join(dir, ent.name);
    if (ent.isDirectory()) {
      sourceFiles(next, out);
      continue;
    }
    const rel = relative(SRC, next);
    if (!/\.(ts|tsx)$/.test(ent.name) || /\.test\.tsx?$/.test(ent.name)) continue;
    if (rel === "routeTree.gen.ts") continue;
    out.push(rel);
  }
  return out;
}

describe("Team Members addresses", () => {
  it("nothing under src links to the old employees addresses except the redirect routes", () => {
    const hits = sourceFiles().filter(
      (rel) =>
        !LEGACY_ROUTE_FILES.has(rel) &&
        /\/dashboard\/employees|\/dashboard\/hub\/employees|"\/dashboard\/team"/.test(read(rel)),
    );
    assert.deepEqual(hits, []);
  });

  it("notification, audit, and Nectar links open the new roster and profile addresses", () => {
    assert.match(
      read("lib/access/access.functions.ts"),
      /`\/dashboard\/team-members\/\$\{context\.userId\}#access`/,
    );
    assert.match(
      read("lib/forms.functions.ts"),
      /`\/dashboard\/team-members\/\$\{data\.staffId\}`/,
    );
    assert.match(
      read("lib/internal-audit.functions.ts"),
      /`\/dashboard\/team-members\/\$\{row\.staff_id\}\?tab=file`/,
    );
    assert.equal(
      read("lib/sow-perimeters.functions.ts").match(/\/dashboard\/team-members\//g)?.length,
      3,
    );
    assert.match(read("lib/nectar/tour-anchors.ts"), /route: "\/dashboard\/team-members"/);
    assert.match(read("lib/nectar-help.functions.ts"), /\/dashboard\/team-members — Team Members/);
    assert.match(read("lib/admin-home-feeling.ts"), /to: "\/dashboard\/team-members"/);
    assert.match(
      read("lib/agency-health.functions.ts"),
      /hr_document_currency: "\/dashboard\/team-members"/,
    );
    assert.match(
      read("lib/employee-smart-import-block.ts"),
      /to: "\/dashboard\/team-members",\s+search: \{ import: 1 \}/,
    );
    assert.match(
      read("components/access/members-panel.tsx"),
      /to="\/dashboard\/team-members\/\$staffId"\s+params=\{\{ staffId: m\.user_id \}\}\s+hash="access"/,
    );
    assert.match(
      read("components/personnel-file/org-personnel-file-matrix.tsx"),
      /search=\{\{ tab: "file" \}\}/,
    );
    assert.match(
      read("components/team-members/add/add-member-dialog.tsx"),
      /\/dashboard\/team-members\/\$\{id\}\?tab=file/,
    );
  });

  it("the sidebar item points at the new address and needs roster View", () => {
    const nav = read("routes/dashboard.tsx");
    assert.match(
      nav,
      /to: "\/dashboard\/team-members",\s+label: "Team Members",\s+icon: Users,\s+perm: "view_staff_records",\s+feature: "staff_onboarding",/,
    );
    assert.equal(nav.match(/label: "Team Members"/g)?.length, 1);
  });

  it("the new routes are permission-gated, titled, and validate their search params", () => {
    const roster = read("routes/dashboard.team-members.index.tsx");
    assert.match(roster, /createFileRoute\("\/dashboard\/team-members\/"\)/);
    assert.match(roster, /RequirePermission perm="view_staff_records"/);
    assert.match(roster, /title: "Team Members — Provider Interface"/);
    assert.match(roster, /<TeamRosterPage \/>/);
    assert.match(roster, /z\.enum\(\["active", "invited", "inactive"\]\)/);
    for (const key of [
      "view",
      "q",
      "filter",
      "home",
      "position",
      "supervisor",
      "sort",
      "add",
      "import",
    ]) {
      assert.match(roster, new RegExp(`^  ${key}: `, "m"), `${key} is a validated search param`);
    }
    const profile = read("routes/dashboard.team-members.$staffId.tsx");
    assert.match(profile, /createFileRoute\("\/dashboard\/team-members\/\$staffId"\)/);
    assert.match(profile, /RequirePermission perm="view_staff_records"/);
    assert.match(profile, /redirectUnlessUuidParam\(params\.staffId/);
    assert.match(profile, /z\.enum\(TEAM_MEMBER_PROFILE_TABS\)/);
    assert.match(profile, /<ProfilePage \/>/);
    assert.match(
      read("lib/team-members/profile-tabs.ts"),
      /TEAM_MEMBER_PROFILE_TABS = \[\s*"profile",\s*"file",\s*"caseload",\s*"notes",\s*"activity",?\s*\] as const/,
    );
  });

  it("the team-progress page and the hire-dates page code are gone", () => {
    assert.equal(existsSync(join(SRC, "routes/dashboard.team.tsx")), false);
    assert.doesNotMatch(
      read("lib/team-members/members.functions.ts"),
      /listStaffHireDates|StaffHireDateRow/,
    );
    assert.match(
      read("lib/team-members/members.functions.ts"),
      /export const bulkSetStaffHireDates/,
    );
    assert.doesNotMatch(
      read("routes/dashboard.employees.hire-dates.tsx"),
      /listStaffHireDates|HireDatesPage/,
    );
  });

  it("the moved modules and components exist at their new homes and the old ones are gone", () => {
    const moved: Array<[string, string]> = [
      ["lib/employee-roster.ts", "lib/team-members/roster.ts"],
      ["lib/employee-roster-upload.ts", "lib/team-members/import.ts"],
      ["lib/employees.functions.ts", "lib/team-members/members.functions.ts"],
      ["lib/invitations.functions.ts", "lib/team-members/invites.functions.ts"],
      ["lib/lifecycle.functions.ts", "lib/team-members/lifecycle.functions.ts"],
      ["lib/staff-profile-identity.ts", "lib/team-members/identity.ts"],
      ["lib/staff-obligation-files.ts", "lib/team-members/file.ts"],
      ["lib/employee-face-sheet.ts", "lib/team-members/staff-record-pdf.ts"],
      ["lib/employee-face-sheet.functions.ts", "lib/team-members/staff-record-pdf.functions.ts"],
      [
        "components/employees/add-employee-wizard.tsx",
        "components/team-members/add/add-member-dialog.tsx",
      ],
      [
        "components/employees/employee-roster-upload-wizard.tsx",
        "components/team-members/add/import-members-dialog.tsx",
      ],
      [
        "components/employees/finish-employee-setup-wizard.tsx",
        "components/team-members/add/finish-setup-dialog.tsx",
      ],
      [
        "components/employees/staff-profile-panel.tsx",
        "components/team-members/profile/profile-tab.tsx",
      ],
      [
        "components/employees/staff-profile-identity.tsx",
        "components/team-members/profile/identity-fields.tsx",
      ],
      [
        "components/employees/staff-obligations-files-tab.tsx",
        "components/team-members/profile/file-tab.tsx",
      ],
      [
        "components/employees/employee-face-sheet-button.tsx",
        "components/team-members/profile/staff-record-button.tsx",
      ],
      ["components/staff/staff-photo-card.tsx", "components/team-members/profile/photo-card.tsx"],
      ["lib/staff/index.ts", "lib/team-members/roster.ts"],
      ["components/staff/index.ts", "components/team-members/profile/photo-card.tsx"],
    ];
    for (const [oldPath, newPath] of moved) {
      assert.equal(existsSync(join(SRC, oldPath)), false, `${oldPath} should be gone`);
      assert.equal(existsSync(join(SRC, newPath)), true, `${newPath} should exist`);
    }
    assert.equal(existsSync(join(SRC, "components/employees")), false);
    assert.equal(existsSync(join(SRC, "components/staff")), false);
    for (const folder of ["roster", "add", "profile", "dialogs"]) {
      assert.equal(existsSync(join(SRC, "components/team-members", folder)), true);
    }
    // No barrel index files in the new folders.
    assert.equal(existsSync(join(SRC, "lib/team-members/index.ts")), false);
    assert.equal(existsSync(join(SRC, "components/team-members/index.ts")), false);
  });

  it("the old addresses are permanent redirect-only routes that keep the hash", () => {
    const expectations: Array<[string, string, RegExp[]]> = [
      [
        "routes/dashboard.employees.index.tsx",
        "/dashboard/employees/",
        [/legacyRosterSearch\(search\)/, /to: "\/dashboard\/team-members"/],
      ],
      [
        "routes/dashboard.employees.$staffId.tsx",
        "/dashboard/employees/$staffId",
        [
          /legacyProfileSearch\(search\)/,
          /"\/dashboard\/team-members\/\$staffId"/,
          /params: \{ staffId \}/,
        ],
      ],
      [
        "routes/dashboard.employees.new.tsx",
        "/dashboard/employees/new",
        [/to: "\/dashboard\/team-members", search: \{ add: 1 \}/],
      ],
      [
        "routes/dashboard.employees.hire-dates.tsx",
        "/dashboard/employees/hire-dates",
        [/filter: "missing_info"/, /to: "\/dashboard\/team-members"/],
      ],
      [
        "routes/dashboard.hub.employees.tsx",
        "/dashboard/hub/employees",
        [
          /tab === "hosts"/,
          /to: "\/dashboard\/hub\/clients"/,
          /tab: "placements"/,
          /to: "\/dashboard\/team-members"/,
        ],
      ],
      ["routes/employees.tsx", "/employees", [/to: "\/dashboard\/team-members"/, /<Outlet \/>/]],
      ["routes/employees.index.tsx", "/employees/", [/to: "\/dashboard\/team-members"/]],
      [
        "routes/employees.new.tsx",
        "/employees/new",
        [/to: "\/dashboard\/team-members", search: \{ add: 1 \}/],
      ],
    ];
    for (const [rel, path, patterns] of expectations) {
      const src = read(rel);
      const lines = src.trimEnd().split("\n").length;
      assert.ok(lines <= 12, `${rel} must stay at most 12 lines (has ${lines})`);
      assert.match(src, new RegExp(`createFileRoute\\("${path.replace(/[$/]/g, "\\$&")}"\\)`), rel);
      assert.match(src, /beforeLoad/, rel);
      assert.match(src, /throw redirect\(/, rel);
      assert.match(src, /hash/, rel);
      assert.match(src, /replace: true/, rel);
      assert.doesNotMatch(src, /useQuery|supabase|RequirePermission|EmployeesPage/, rel);
      for (const pattern of patterns) assert.match(src, pattern, `${rel} ${pattern}`);
    }
  });

  it("the dead training-hours code and the old barrels are gone", () => {
    for (const rel of [
      "components/hr/annual-hours-progress.tsx",
      "lib/hr-training-hours.functions.ts",
      "lib/staff/index.ts",
      "components/staff/index.ts",
    ]) {
      assert.equal(existsSync(join(SRC, rel)), false, `${rel} should be deleted`);
    }
    assert.equal(existsSync(join(SRC, "components/hr/staff-fields-panel.tsx")), true);
  });
});
