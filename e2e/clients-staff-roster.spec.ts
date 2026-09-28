/**
 * Focused e2e: Hive CLIENTS + STAFF ROSTER (admin view, Sep 1 True North).
 *
 * Mock admin auth + fixture roster. Does not create/delete live clients or staff.
 *
 * Run: npm run test:e2e
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { CLIENTS, STAFF } from "./fixtures/tns-roster";
import { assertPageNotBlank, installHiveMocks, waitForDashboard } from "./helpers/mock-hive";

test.use({ storageState: { cookies: [], origins: [] } });

const ARTIFACT_DIR = fs.existsSync("/opt/cursor/artifacts")
  ? "/opt/cursor/artifacts"
  : path.join(process.cwd(), "test-results", "clients-staff-roster");

async function shot(page: Page, name: string, fullPage = false) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, `${name}.png`),
    fullPage,
  });
}

async function gotoAdmin(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForDashboard(page);
}

/** Names render in both the mobile card list (hidden on desktop) and the table. */
function rosterName(page: Page, name: string) {
  // .first(): a name can also appear in another row's Supervisor cell.
  return page.locator("table").getByText(name, { exact: true }).first();
}

/** The roster Name-column link (a name can also sit in the Supervisor cell). */
function nameLink(page: Page, name: string) {
  return page.locator("table").getByRole("link", { name, exact: true });
}

test.describe("Clients + Staff roster — mocked admin", () => {
  test.beforeEach(async ({ page }) => {
    await installHiveMocks(page, { persona: "admin" });
  });

  test("1. Clients list loads; search/filter; open a chart without crash", async ({ page }) => {
    await gotoAdmin(page, "/dashboard/clients");
    await expect(page.getByRole("heading", { name: /Client Directory/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(rosterName(page, "Tommy Jones")).toBeVisible();
    await expect(rosterName(page, "Blake Stevens")).toBeVisible();
    await expect(rosterName(page, "Stephen Prince")).toBeVisible();
    await expect(rosterName(page, "Marcus Rivera")).toBeVisible();
    await expect(page.locator("table").getByText("DSI").first()).toBeVisible();

    const search = page.getByPlaceholder(/Search by name or Medicaid ID/i);
    await expect(search).toBeVisible();
    await search.fill("Jones");
    await expect(rosterName(page, "Tommy Jones")).toBeVisible();
    await expect(page.getByText("Blake Stevens", { exact: true })).toHaveCount(0);

    await search.fill("zzzz-no-match");
    await expect(page.getByText(/No clients match your search/i).first()).toBeVisible();
    await search.fill("");
    await expect(rosterName(page, "Blake Stevens")).toBeVisible();

    await page
      .getByRole("link", { name: /Tommy Jones/i })
      .first()
      .click();
    await page.waitForURL(/\/dashboard\/clients\/00000000-0000-4000-a000-000000000101/);
    await expect(page.getByRole("heading", { name: /Tommy Jones/i })).toBeVisible({
      timeout: 15_000,
    });
    await assertPageNotBlank(page, "client chart after list click");
    await shot(page, "clients_list_and_chart");
  });

  test("2. Client chart shows DSPD codes, home, and key care tabs", async ({ page }) => {
    await gotoAdmin(page, `/dashboard/clients/${CLIENTS.tommy.id}`);
    await expect(page.getByRole("heading", { name: /Tommy Jones/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Host home/i).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Identity$/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Care plan/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Billing$/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Client file$/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Operations/i })).toBeVisible();

    await page.getByRole("tab", { name: /^Billing$/i }).click();
    await expect(page.getByText("DSI").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("HHS").first()).toBeVisible();
    await expect(page.getByText("SEI").first()).toBeVisible();
    await expect(page.getByText("SLH").first()).toBeVisible();

    await page.getByRole("tab", { name: /Care plan/i }).click();
    await expect(page.getByRole("tab", { name: /^Goals$/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Target Behaviors/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Medications/i })).toBeVisible();

    await gotoAdmin(page, "/dashboard/homes");
    await expect(page.getByRole("heading", { name: /Homes & Teams/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Maple House").first()).toBeVisible();
    await expect(page.getByText("Oak SLH").first()).toBeVisible();
    await expect(page.getByText(/Tommy/i).first()).toBeVisible();
    await shot(page, "client_chart_codes_and_homes");
  });

  test("3. Pending clients page loads", async ({ page }) => {
    await gotoAdmin(page, "/dashboard/clients/pending");
    await expect(page.getByRole("heading", { name: /Pending Clients/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(/haven't joined your directory|All imported clients are finalized/i).first(),
    ).toBeVisible();
    await assertPageNotBlank(page, "pending clients");
    await shot(page, "pending_clients");
  });

  test("4. Team Members list loads; staff profile shows role at a glance", async ({ page }) => {
    // The old address is a permanent redirect — saved notifications and emails still use it.
    await gotoAdmin(page, "/dashboard/employees");
    await expect(page).toHaveURL(/\/dashboard\/team-members\/?$/);
    await expect(page.getByRole("heading", { level: 2, name: /Team members/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /^Active$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Inactive$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Import team members/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Smart Import/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Import CSV/i })).toHaveCount(0);
    await expect(rosterName(page, "Jake Probert")).toBeVisible();
    await page.getByRole("button", { name: /^Inactive$/i }).click();
    await expect(page.getByText(/No deactivated team members/i).first()).toBeVisible();
    await expect(rosterName(page, "Jake Probert")).toHaveCount(0);
    await page.getByRole("button", { name: /^Active$/i }).click();
    await expect(rosterName(page, "Jake Probert")).toBeVisible();
    await expect(rosterName(page, "Harvey Alisa")).toBeVisible();
    await expect(rosterName(page, "Tom Jones")).toBeVisible();
    await expect(rosterName(page, "Dane Warnick")).toBeVisible();
    // Position column (two, then +N); Owner / Admin badge by the name; no preset anywhere.
    await expect(
      page.locator("table").getByRole("columnheader", { name: "Position" }),
    ).toBeVisible();
    await expect(page.locator("table").getByRole("columnheader", { name: "Preset" })).toHaveCount(
      0,
    );
    await expect(
      page.locator("table").getByText("Operations Director, Direct Support Professional"),
    ).toBeVisible();
    await expect(page.locator("table").getByText("+1", { exact: true })).toBeVisible();
    await expect(page.locator("table").getByTestId("level-badge").first()).toHaveText(
      /^(Owner|Admin)$/,
    );
    await expect(page.locator("table").getByText(/Program Manager|Full access/)).toHaveCount(0);
    await expect(page.locator("table").getByText("Maple House").first()).toBeVisible();
    // Evidence column: same labels as the Evidence page data, including No pack yet.
    await expect(page.locator("table").getByText("All current").first()).toBeVisible();
    await expect(page.locator("table").getByText("2 missing")).toBeVisible();
    await expect(page.locator("table").getByText("1 due soon")).toBeVisible();
    await expect(
      page.locator("table").getByRole("link", { name: "No pack yet" }).first(),
    ).toBeVisible();
    await expect(page.locator("table").getByText("Pending first login")).toBeVisible();
    await expect(page.locator("table").getByRole("button", { name: /^Last login/i })).toBeVisible();
    await expect(page.locator("table").getByRole("columnheader", { name: /^Login$/i })).toHaveCount(
      0,
    );
    await expect(
      page.locator("table").getByRole("columnheader", { name: /^Status$/i }),
    ).toHaveCount(0);
    await expect(page.locator("table").getByRole("button", { name: /Caseload/i })).toHaveCount(0);
    await expect(
      page
        .locator("table")
        .getByRole("button", { name: /More actions/i })
        .first(),
    ).toBeVisible();
    await expect(page.locator("table").getByRole("link", { name: /Staff file/i })).toHaveCount(0);
    await expect(page.locator("table").getByRole("link", { name: /^View$/i })).toHaveCount(0);
    await expect(page.locator("table").getByText("Aug 27, 2026").first()).toBeVisible();
    await expect(page.getByText("Platform admin")).toHaveCount(0);
    await expect(page.getByTestId("roster-counts")).toHaveText(/5 active · 0 inactive · 2 invited/);

    // Search (debounced) and filter chips live in the URL.
    await page.getByLabel("Search team members").fill("probert");
    await expect(page).toHaveURL(/q=probert/);
    await expect(nameLink(page, "Harvey Alisa")).toHaveCount(0);
    await expect(nameLink(page, "Jake Probert")).toBeVisible();
    await expect(page.getByTestId("roster-showing")).toHaveText(/Showing 1 of 5 · Clear filter/);
    await page.getByLabel("Clear search").click();
    await expect(page.getByTestId("roster-showing")).toHaveCount(0);

    // Filter buttons: one at a time, solid when on, click again to clear.
    const missingBtn = page.getByTestId("roster-filter-missing");
    const expiringBtn = page.getByTestId("roster-filter-expiring");
    await missingBtn.click();
    await expect(page).toHaveURL(/filter=missing(&|$)/);
    await expect(missingBtn).toHaveAttribute("aria-pressed", "true");
    await expect(missingBtn).toHaveClass(/bg-primary/);
    await expect(nameLink(page, "Harvey Alisa")).toBeVisible();
    await expect(nameLink(page, "Jake Probert")).toHaveCount(0);
    await expect(page.getByTestId("roster-showing")).toHaveText(/Showing 1 of 5/);
    await expiringBtn.click();
    await expect(page).toHaveURL(/filter=expiring(&|$)/);
    await expect(missingBtn).toHaveAttribute("aria-pressed", "false");
    await expect(nameLink(page, "Tom Jones")).toBeVisible();
    await expect(nameLink(page, "Harvey Alisa")).toHaveCount(0);
    await expiringBtn.click();
    await expect(page).not.toHaveURL(/filter=/);
    await expect(nameLink(page, "Jake Probert")).toBeVisible();
    // A button with nobody in it is disabled and says why.
    const reviewBtn = page.getByTestId("roster-filter-review");
    await expect(reviewBtn).toBeDisabled();
    await reviewBtn.locator("..").hover();
    await expect(
      page.getByRole("tooltip").filter({ hasText: "Nothing is awaiting review." }).first(),
    ).toBeVisible();
    // Missing info lists what's missing on hover.
    await page.locator("table").getByTestId("missing-info-chip").first().hover();
    await expect(
      page.getByRole("tooltip").filter({ hasText: "Date of birth, address" }).first(),
    ).toBeVisible();
    // Position dropdown narrows the list; Clear filter resets everything.
    await page.getByRole("combobox", { name: "Position" }).click();
    await page.getByRole("option", { name: "Host Home Provider" }).click();
    await expect(page).toHaveURL(/position=hhp/);
    await expect(page.getByTestId("roster-showing")).toHaveText(/Showing 2 of 5/);
    await page.getByRole("button", { name: "Clear filter" }).click();
    await expect(page).not.toHaveURL(/position=/);
    await expect(page.getByRole("combobox", { name: "Preset" })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Home" })).toBeVisible();
    await page.getByRole("button", { name: /^Evidence/ }).click();
    await expect(page).toHaveURL(/sort=evidence/);

    // Export CSV downloads the filtered rows with today's date in the name.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export CSV/i }).click();
    expect((await download).suggestedFilename()).toMatch(/^team-members-\d{4}-\d{2}-\d{2}\.csv$/);

    // Reset password: the app's own dialog, server-generated password shown once.
    await page.getByRole("button", { name: "More actions for Jake Probert" }).click();
    await expect(page.getByRole("menuitem", { name: /Review evidence pack/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Edit caseload/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Deactivate/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Delete/i })).toHaveCount(0);
    await page.getByRole("menuitem", { name: /Reset password/i }).click();
    await page
      .getByTestId("reset-password-dialog")
      .getByRole("button", { name: /^Reset password$/ })
      .click();
    await expect(page.getByText("Mock-Temp-Pass1")).toBeVisible();
    await shot(page, "team_members_reset_password");
    await page.getByRole("button", { name: /^Done$/ }).click();
    // No Reset / Deactivate on your own row.
    await page.getByRole("button", { name: "More actions for Roster Admin" }).click();
    await expect(page.getByRole("menuitem", { name: /Reset password/i })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /Deactivate/i })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /Send invite/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Settings$/i })).toHaveCount(0);
    await shot(page, "team_members_roster_desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    // Cards below 768 px; ⋯ opens the same actions in a bottom sheet.
    await page.getByRole("button", { name: "More actions for Harvey Alisa" }).click();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: /Open profile/i }),
    ).toBeVisible();
    await shot(page, "team_members_roster_mobile_sheet");
    await page.keyboard.press("Escape");
    await shot(page, "team_members_roster_mobile");
    await page.setViewportSize({ width: 1280, height: 720 });

    // Leave the roster filtered so the profile's back buttons can bring it back.
    await missingBtn.click();
    await page.getByRole("button", { name: /^Evidence/ }).click();
    await expect(page).toHaveURL(/filter=missing/);
    await nameLink(page, "Harvey Alisa").click();
    await page.waitForURL(new RegExp(`/dashboard/team-members/${STAFF.harvey.id}`));
    // Tabs replace history; both back buttons and browser Back return to the same list.
    await page.getByRole("tab", { name: /Team member file/i }).click();
    await expect(page).toHaveURL(/tab=file/);
    await page.getByRole("tab", { name: /^Activity$/i }).click();
    await expect(page).toHaveURL(/tab=activity/);
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\/team-members\/?\?.*filter=missing/);
    await expect(page.getByTestId("roster-filter-missing")).toHaveAttribute("aria-pressed", "true");
    await nameLink(page, "Harvey Alisa").click();
    await page.getByTestId("profile-back").click();
    await expect(page).toHaveURL(/\/dashboard\/team-members\/?\?.*filter=missing/);
    await expect(page).toHaveURL(/sort=-?evidence/);
    await nameLink(page, "Harvey Alisa").click();
    await page.getByTestId("profile-back-to-list").click();
    await expect(page).toHaveURL(/\/dashboard\/team-members\/?\?.*filter=missing/);
    await page.getByRole("button", { name: "Clear filter" }).click();

    await rosterName(page, "Jake Probert").click();
    await page.waitForURL(new RegExp(`/dashboard/team-members/${STAFF.jake.id}`));
    await expect(page).toHaveURL(new RegExp(`/dashboard/team-members/${STAFF.jake.id}`));
    await expect(page.getByTestId("staff-profile-page")).toHaveAttribute(
      "data-staff-id",
      STAFF.jake.id,
    );
    await expect(page.getByTestId("staff-profile-heading")).toHaveText(/Jake Probert/);
    await expect(page.getByTestId("staff-profile-identity")).toHaveAttribute(
      "data-staff-id",
      STAFF.jake.id,
    );
    await expect(page.getByTestId("staff-profile-identity")).toContainText("Jake");
    await expect(page.getByTestId("staff-profile-identity")).toContainText("Probert");
    await expect(page.getByTestId("staff-profile-identity")).not.toContainText("Dane");
    await expect(page.getByTestId("staff-profile-identity")).not.toContainText("Owner");
    await expect(page.getByTestId("staff-profile-heading")).not.toHaveText(/Dane|Roster Admin/);
    await expect(page.getByRole("tab", { name: /^Profile$/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("tab", { name: /Team member file/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Activity$/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Permissions$/i })).toHaveCount(0);
    await expect(page.getByTestId("staff-profile-identity")).toContainText("Team member");
    await expect(
      page.getByText(/admin|employee|manager|Owner|Team member|Supervisor/i).first(),
    ).toBeVisible();
    await assertPageNotBlank(page, "staff profile");

    await expect(page.getByText(/Team member ID/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Team Member Face Sheet/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Edit profile/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Access", exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("profile-access-level")).toBeVisible();
    await shot(page, "team_member_face_sheet_desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, "team_member_face_sheet_mobile");
    await page.setViewportSize({ width: 1280, height: 720 });
    await shot(page, "employees_list_and_profile");
  });

  test("5. Add team member wizard — full file first, then invite or temp password", async ({
    page,
  }) => {
    await gotoAdmin(page, "/dashboard/team-members");
    await expect(page.getByRole("button", { name: /^Add team member$/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /Invite by email/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Add manually/i })).toHaveCount(0);

    await page.getByRole("button", { name: /^Add team member$/i }).click();
    const dialog = page.getByTestId("add-team-member-dialog");
    await expect(dialog.getByRole("heading", { name: /Add team member/i })).toBeVisible();
    // One person, one screen: no multi-person cards, no org-configured fields.
    await expect(page.getByRole("button", { name: /Add another team member/i })).toHaveCount(0);
    await expect(page.getByText(/Your organization's fields/i)).toHaveCount(0);
    await expect(page.getByText(/drives training requirements/i)).toHaveCount(0);
    await expect(dialog.getByText("Job title")).toHaveCount(0);
    for (const label of ["Basics", "Role", "DSPD"]) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByLabel(/Hire date/i)).toBeVisible();
    await expect(dialog.getByLabel(/Date of birth/i)).toBeVisible();
    await expect(page.getByRole("switch", { name: /Transports clients/i })).toBeVisible();
    await expect(dialog.getByText(/What they can see and do in PI/i)).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: /Email an invite now/i })).toBeChecked();
    await expect(page.getByLabel(/End date/i)).toHaveCount(0);
    await expect(page.getByText(/Assigned training tracks/i)).toHaveCount(0);
    await expect(page.getByText(/Behavior-related training/i)).toHaveCount(0);
    await shot(page, "add_team_member_wizard_desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, "add_team_member_wizard_mobile");
    await page.setViewportSize({ width: 1280, height: 720 });

    // Access: grouped presets; the admin persona is an Owner, so Owner + Admin presets show.
    await page.locator("#access").click();
    await expect(page.getByRole("option", { name: "Owner", exact: true })).toBeVisible();
    await expect(page.getByText("Admin presets", { exact: true })).toBeVisible();
    await expect(page.getByText("Team member presets", { exact: true })).toBeVisible();
    await page.getByRole("option", { name: "DSP", exact: true }).click();

    // Position is one multi-select from staff_types.
    await dialog.getByText("Choose positions").click();
    await page.getByRole("button", { name: /Host Home Provider/ }).click();
    await dialog.getByRole("heading", { name: /Add team member/i }).click();

    await page.locator("#first_name").fill("Sep");
    await page.locator("#last_name").fill("Tester");
    await page.locator("#email").fill("sep1.tester@example.test");
    await page.locator("#phone").fill("555-010-0199");
    await page.locator("#hire_date").fill("2026-07-01");
    await dialog.getByRole("button", { name: /^Add team member$/i }).click();

    await expect(dialog.getByText("Invite sent to sep1.tester@example.test")).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog.getByRole("button", { name: /Open profile/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Add another/i })).toBeVisible();
    await shot(page, "add_employee_wizard_access");

    // Review evidence pack opens the existing Evidence questionnaire, pre-filled
    // from Position (Host Home Provider → HHS host pack). Nothing is created yet.
    await dialog.getByRole("button", { name: /Review evidence pack/i }).click();
    const quiz = page.locator("[data-evidence-quiz]");
    await expect(quiz).toBeVisible({ timeout: 15_000 });
    await expect(quiz.getByText(/Team member packs · Sep Tester/)).toBeVisible();
    await quiz.getByRole("button", { name: /See team member suggestions/i }).click();
    await expect(quiz.getByText("Host Home Certification", { exact: true })).toBeVisible();
    await expect(quiz.getByRole("button", { name: /Apply packs/i })).toBeDisabled();
    await shot(page, "add_team_member_review_evidence");
    await quiz.getByRole("button", { name: /^Back$/ }).click();
    await quiz.getByRole("button", { name: /^Back$/ }).click();
    await expect(quiz).toHaveCount(0);

    // The old invitations page redirects to the roster's Invited view.
    await gotoAdmin(page, "/dashboard/invitations");
    await expect(page).toHaveURL(/\/dashboard\/team-members\/?\?view=invited/, { timeout: 20_000 });
    const invited = page.getByTestId("invites-view");
    await expect(invited.getByText("new.dsp@example.test")).toBeVisible();
    await expect(invited.getByText(/^Expired$/).first()).toBeVisible();
    await expect(invited.getByRole("button", { name: /Resend/i })).toBeVisible();
    await expect(invited.getByRole("button", { name: /Copy link/i })).toBeVisible();
    await expect(invited.getByRole("button", { name: /^Send invite$/i })).toBeVisible();
    await expect(invited.getByText(/Account created — no invite email sent/)).toBeVisible();
    await expect(invited.getByText(/Not invited yet/)).toHaveCount(0);
    await expect(invited.getByText(/Program Manager|Default preset|DSP/)).toHaveCount(0);
    await invited.getByRole("button", { name: /Uninvite/i }).click();
    await expect(page.getByRole("alertdialog")).toContainText(/Uninvite new\.dsp@example\.test\?/);
    await shot(page, "team_members_invited_view");
    await page.getByRole("button", { name: /^Cancel$/ }).click();
    await expect(page.getByRole("button", { name: /Invite by email/i })).toHaveCount(0);
    await assertPageNotBlank(page, "invitations");
  });

  test("roster hides the Home filter when the org has no homes", async ({ page }) => {
    await installHiveMocks(page, { persona: "admin", noHomes: true });
    await gotoAdmin(page, "/dashboard/team-members?filter=bogus,review,missing");
    await expect(page.getByRole("combobox", { name: "Position" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("combobox", { name: "Supervisor" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Home" })).toHaveCount(0);
    // An old comma list keeps its first valid key, one filter on.
    await expect(page.getByTestId("roster-filter-review")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("roster-filter-missing")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // Clicking another filter replaces it with a single value.
    await page.getByTestId("roster-filter-missing").click();
    await expect(page).toHaveURL(/filter=missing(&|$)/);
  });

  test("staff surfaces: teams→homes, access", async ({ page }) => {
    await gotoAdmin(page, "/dashboard/teams");
    await expect(page).toHaveURL(/\/dashboard\/homes/);
    await expect(page.getByRole("heading", { name: /Homes & Teams/i }).first()).toBeVisible();

    // /dashboard/roles was replaced by Settings → Access & presets (#389).
    await gotoAdmin(page, "/dashboard/settings/team-access");
    await expect(page.getByRole("heading", { name: /Access & presets/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertPageNotBlank(page, "access");
    await shot(page, "staff_team_homes_roles");
  });

  test("7. Empty and error states do not blank the page", async ({ page }) => {
    // Reinstall with empty roster after the default beforeEach — next nav uses it.
    await installHiveMocks(page, { persona: "admin", emptyClients: true });
    await gotoAdmin(page, "/dashboard/clients");
    await expect(page.getByText(/No clients yet|Add your first client/i)).toBeVisible({
      timeout: 20_000,
    });
    await assertPageNotBlank(page, "empty clients");

    await installHiveMocks(page, { persona: "admin", clientsError: true });
    await gotoAdmin(page, "/dashboard/clients");
    await page.waitForTimeout(800);
    await assertPageNotBlank(page, "clients error");
    const body = (await page.locator("body").innerText()) || "";
    expect(
      /something went wrong|no clients|mocked clients read failure|Client Directory/i.test(body),
    ).toBeTruthy();

    await installHiveMocks(page, { persona: "admin" });
    await gotoAdmin(page, "/dashboard/clients/00000000-0000-0000-0000-ffffffffffff");
    await page.waitForTimeout(800);
    await assertPageNotBlank(page, "missing client chart");
    await shot(page, "empty_and_error_states");
  });
});

test.describe("Employees flatten and Clients placements", () => {
  test.beforeEach(async ({ page }) => {
    await installHiveMocks(page, { persona: "admin" });
  });

  test("Team Members is the roster with no tab bar; old hub tabs redirect", async ({ page }) => {
    await gotoAdmin(page, "/dashboard/hub/employees");
    await expect(page).toHaveURL(/\/dashboard\/team-members\/?$/);
    await expect(page.getByRole("heading", { level: 2, name: /Team members/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("navigation", { name: "Tabs" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Hosts$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /HR Admin/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Employee Loans/i })).toHaveCount(0);
    await expect(rosterName(page, "Jake Probert")).toBeVisible();
    await shot(page, "employees_roster_desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 2, name: /Team members/i })).toBeVisible();
    await shot(page, "employees_roster_mobile");
    await page.setViewportSize({ width: 1280, height: 720 });

    await gotoAdmin(page, "/dashboard/hub/employees?tab=loans");
    await expect(page).toHaveURL(/\/dashboard\/team-members\/?$/);
    await expect(page.getByRole("heading", { level: 2, name: /Team members/i })).toBeVisible();

    await gotoAdmin(page, "/dashboard/hub/employees?tab=hr-admin");
    await expect(page).toHaveURL(/\/dashboard\/team-members\/?$/);

    await gotoAdmin(page, "/dashboard/hub/employees?tab=hosts");
    await expect(page).toHaveURL(/\/dashboard\/hub\/clients\?tab=placements/);
    await expect(page.getByRole("heading", { name: /^Placements$/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("Clients Placements is the host pipeline; old hosts tab redirects", async ({ page }) => {
    await gotoAdmin(page, "/dashboard/hub/clients?tab=placements");
    await expect(
      page.getByRole("navigation", { name: "Tabs" }).getByText("Placements"),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: /^Placements$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Onboarding$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Ready$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Placed$/i })).toBeVisible();
    await expect(page.getByText(/No hosts in this state/i).first()).toBeVisible();
    await shot(page, "clients_placements_desktop");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: /^Placements$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Onboarding$/i })).toBeVisible();
    await shot(page, "clients_placements_mobile");

    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoAdmin(page, "/dashboard/hub/clients?tab=hosts");
    await expect(page).toHaveURL(/tab=placements/);
    await expect(page.getByRole("heading", { name: /^Placements$/i })).toBeVisible();
  });
});

test.describe("Add team member — used to work here", () => {
  test("offers Reactivate instead of a new account", async ({ page }) => {
    await installHiveMocks(page, { persona: "admin", inactiveMatch: true });
    await gotoAdmin(page, "/dashboard/team-members");
    await page.getByRole("button", { name: /^Add team member$/i }).click();
    const dialog = page.getByTestId("add-team-member-dialog");
    await page.locator("#first_name").fill("Tom");
    await page.locator("#last_name").fill("Returning");
    await page.locator("#email").fill("tom.returning@example.test");
    await page.locator("#hire_date").fill("2026-07-01");
    await dialog.getByRole("button", { name: /^Add team member$/i }).click();
    await expect(dialog.getByText(/used to work here\. Reactivate instead\?/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog.getByRole("button", { name: /^Reactivate$/ })).toBeVisible();
    await shot(page, "add_team_member_inactive_match");
  });
});

test.describe("Import team members", () => {
  test.beforeEach(async ({ page }) => {
    await installHiveMocks(page, { persona: "admin" });
  });

  test("editable, removable review rows, invites, then Evidence for everyone", async ({ page }) => {
    await gotoAdmin(page, "/dashboard/team-members");
    await expect(page.getByRole("heading", { level: 2, name: /Team members/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /Finish setup/i })).toHaveCount(0);
    await expect(page.getByTestId("needs-setup-chip")).toHaveCount(0);

    await page.getByRole("button", { name: /Import team members/i }).click();
    await expect(page.getByRole("heading", { name: /Import team members/i })).toBeVisible();
    await expect(page.getByTestId("import-drop-zone")).toBeVisible();
    await expect(page.getByRole("button", { name: /Download Excel template/i })).toBeEnabled();
    await shot(page, "add_several_dialog_desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, "add_several_dialog_mobile");
    await page.setViewportSize({ width: 1280, height: 1100 });

    await page
      .locator("#roster-paste")
      .fill(
        [
          "name,email,phone,hire_date,preset,home,job_title,transports",
          "Alex Kim,alex.kim@example.test,555-0199,8/1/26,Owner,,Coach,",
          "Sam Rivera,sam.rivera@example.test,555-0100,2026-07-01,Lead DSP,Maple House,,yes",
          "Pat,not-an-email,,,,,,",
          "Jake Probert,jake.probert@example.test,555-0101,2026-01-15,DSP,,,",
        ].join("\n"),
      );
    await page.getByRole("button", { name: /Review pasted rows/i }).click();
    const review = page.getByTestId("import-review");
    await expect(review.getByText(/Already here — skipped/i)).toBeVisible();
    await expect(review.getByText(/Enter a valid email/i)).toBeVisible();
    await expect(review.getByText(/Owner can't be given from a spreadsheet/i)).toBeVisible();
    await expect(
      review.getByRole("checkbox", { name: /Email invites to everyone/i }),
    ).toBeChecked();
    await expect(review.getByLabel("Hire date").first()).toHaveValue("2026-08-01");
    await shot(page, "add_several_preview_desktop");

    // The preset dropdown is the agency's presets, without Owner.
    await review.getByTestId("access-preset-select").first().click();
    await expect(page.getByRole("option", { name: "Lead DSP", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "Owner", exact: true })).toHaveCount(0);
    await page.getByRole("option", { name: "DSP", exact: true }).click();

    // Remove the bad row.
    await expect(review.getByTestId("import-row")).toHaveCount(4);
    await review
      .getByTestId("import-row")
      .nth(2)
      .getByRole("button", { name: /Remove row/i })
      .click();
    await expect(review.getByTestId("import-row")).toHaveCount(3);
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, "add_several_preview_mobile");
    await page.setViewportSize({ width: 1280, height: 1100 });

    await review.getByRole("button", { name: /Add 2 people/i }).click();
    await expect(page.getByTestId("import-done-summary")).toHaveText(
      "Added 2. Invites sent to 2.",
      {
        timeout: 15_000,
      },
    );
    await expect(
      page.getByText(/jake\.probert@example\.test: Already on the roster/),
    ).toBeVisible();
    await page.getByRole("button", { name: /Review evidence packs for 2 people/i }).click();
    const quiz = page.locator("[data-evidence-quiz]");
    await expect(quiz).toBeVisible({ timeout: 15_000 });
    await expect(quiz.getByText(/Team member packs · 2 people/)).toBeVisible();
    await shot(page, "import_review_evidence_packs");
  });
});

test.describe("Access levels screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await installHiveMocks(page, { persona: "admin" });
  });

  test("access presets, bulk access dropdown, and profile scope save", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAdmin(page, "/dashboard/settings/team-access");
    await expect(page.getByRole("heading", { name: /Access & presets/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Team member/i).first()).toBeVisible();
    await expect(page.getByText("Pat Lee")).toBeVisible();
    await expect(page.getByText(/Owner, Admin, or Team member/i)).toBeVisible();
    await page.getByRole("tab", { name: "Presets" }).click();
    await expect(page.getByText("Program Manager").first()).toBeVisible();
    await expect(page.getByText("DSP").first()).toBeVisible();
    const rosterCategory = page.getByText("Team roster & profiles").first();
    await rosterCategory.scrollIntoViewIfNeeded();
    await expect(rosterCategory).toBeVisible();
    await expect(page.getByText("Hire & deactivate team members").first()).toBeVisible();
    await expect(
      page.getByText(/Staff roster|Hire & deactivate staff|Staff compliance/i),
    ).toHaveCount(0);
    await shot(page, "access-presets", true);

    await gotoAdmin(page, "/dashboard/team-members");
    await page.getByRole("button", { name: /Import team members/i }).click();
    await page
      .locator("#roster-paste")
      .fill("Sam Rivera, sam.rivera@example.test, 555-0100, 2026-07-01, DSP\n");
    await page.getByRole("button", { name: /Review pasted rows/i }).click();
    await expect(page.getByTestId("access-preset-select")).toBeVisible();
    await page.getByTestId("access-preset-select").click();
    await expect(page.getByText("Team member presets", { exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "DSP", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "Owner", exact: true })).toHaveCount(0);
    await expect(page.getByRole("option", { name: "Supervisor", exact: true })).toHaveCount(0);
    await shot(page, "bulk-upload-access-level");
    await page.keyboard.press("Escape");

    await gotoAdmin(page, `/dashboard/team-members/${STAFF.jake.id}`);
    await expect(page.getByRole("heading", { name: "Access", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Leads group / Scope")).toHaveCount(0);
    await expect(page.getByText(/Scope columns are not live/i)).toHaveCount(0);
    await expect(page.getByTestId("profile-access-level")).toHaveText("Admin");
    await expect(page.getByTestId("profile-access-badge")).toHaveText("Admin");
    await page.getByRole("button", { name: /Edit access/i }).click();
    await page.getByText("Whole agency", { exact: true }).click();
    await page.getByRole("option", { name: /Assigned homes, team members, and clients/i }).click();
    await page.getByText("Pick homes").click();
    await page.getByText("Maple House", { exact: true }).click();
    await page.getByRole("button", { name: /Save access/i }).click();
    await expect(page.getByText("Access saved")).toBeVisible();
    await expect(page.getByText(/Assigned homes, team members, and clients/i)).toBeVisible();
    await expect(page.getByText("1 assigned").first()).toBeVisible();
    await expect(page.getByTestId("profile-access-level")).toHaveText("Admin");
    await expect(page.getByTestId("profile-access-badge")).toHaveText("Admin");
    await shot(page, "profile-admin-scope-save", true);
  });
});

test.describe("RBAC — DSP / employee cannot open employee admin", () => {
  test.beforeEach(async ({ page }) => {
    await installHiveMocks(page, { persona: "dsp" });
  });

  test("6. DSP is gated off the Team Members admin roster", async ({ page }) => {
    await gotoAdmin(page, "/dashboard/team-members");
    await expect(page).toHaveURL(/\/unauthorized/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /Access denied/i })).toBeVisible();
    await expect(page.getByText(/Team roster & profiles: View/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Invite by email/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Add team member$/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: /Team members/i })).toHaveCount(0);
    await shot(page, "dsp_rbac_employees_gated");
  });
});
