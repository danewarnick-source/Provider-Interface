/**
 * Mocked e2e: the client profile side menu opens every section, the
 * Overview draws the needs-attention cards, and old ?tab= links land on the
 * section that now holds them. Made-up fixtures only.
 */
import { test, expect } from "@playwright/test";
import { CLIENTS } from "./fixtures/tns-roster";
import { installHiveMocks, waitForDashboard } from "./helpers/mock-hive";

test.use({ storageState: { cookies: [], origins: [] } });

const SECTIONS = [
  "profile",
  "contacts",
  "health",
  "plans",
  "services",
  "money",
  "file",
  "team",
  "activity",
  "overview",
] as const;

test("client profile opens every section from the side menu", async ({ page }) => {
  await installHiveMocks(page);
  await page.goto(`/dashboard/clients/${CLIENTS.tommy.id}`, { waitUntil: "domcontentloaded" });
  await waitForDashboard(page);

  const pageRoot = page.getByTestId("client-profile-page");
  await expect(pageRoot).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("client-profile-heading")).toBeVisible();
  await expect(page.getByTestId("client-section-overview")).toBeVisible();
  await expect(page.getByTestId("client-attention-card")).toHaveCount(2);
  await expect(page.getByTestId("client-units-row")).toHaveCount(1);
  await expect(page.getByTestId("client-team-ready")).toHaveText("Ready alone");

  for (const key of SECTIONS) {
    await page.getByTestId(`profile-section-${key}`).first().click();
    await expect(pageRoot).toHaveAttribute("data-active-section", key);
    await expect(page.getByTestId(`client-section-${key}`)).toBeVisible({ timeout: 20_000 });
    if (key === "health") {
      await expect(page.getByTestId("advance-directive")).toBeVisible();
      await expect(page.getByTestId("client-health-events")).toBeVisible();
    }
    if (key === "plans") {
      await expect(page.getByTestId("client-plan-years")).toBeVisible();
      await expect(page.getByTestId("plan-view-as")).toBeVisible();
      await expect(page.getByTestId("client-summaries-owed")).toBeVisible();
    }
    if (key === "services") {
      await expect(page.getByTestId("client-authorization-row")).toHaveCount(1);
      await expect(page.getByText("600 left")).toBeVisible();
      await expect(page.getByTestId("client-monthly-budget")).toBeVisible();
    }
    if (key === "money") {
      await expect(page.getByTestId("client-money-pba")).toBeVisible();
      await expect(page.getByText("$420.00")).toBeVisible();
      await expect(page.getByTestId("pba-audit")).toBeVisible();
      await expect(page.getByTestId("client-money-spending")).toBeVisible();
    }
    if (key === "team") {
      await expect(page.getByTestId("client-team-codes")).toBeVisible();
      await expect(page.getByTestId("client-do-not-schedule")).toBeVisible();
    }
    if (key === "activity") {
      await expect(page.getByTestId("client-activity-shifts")).toBeVisible();
      await expect(page.getByTestId("client-activity-logs")).toBeVisible();
    }
    if (key === "file") {
      await expect(page.getByTestId("client-required-document")).toHaveCount(3);
      await expect(page.getByText("sample-1056.pdf")).toBeVisible();
    }
    if (key === "overview") await expect(page).not.toHaveURL(/section=/);
    else await expect(page).toHaveURL(new RegExp(`section=${key}`));
  }

  // A needs-attention card opens the section that fixes it.
  await page.getByTestId("client-attention-card").filter({ hasText: "Guardian" }).click();
  await expect(pageRoot).toHaveAttribute("data-active-section", "contacts");
  await expect(page.getByTestId("client-guardian-note")).toBeVisible();
});

test("desktop: the dark sidebar becomes the profile menu; All clients returns to the list as left", async ({
  page,
}) => {
  await installHiveMocks(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard/clients", { waitUntil: "domcontentloaded" });
  await waitForDashboard(page);
  const search = page.getByPlaceholder("Search by name, Medicaid ID or PID...");
  await search.fill("Tommy");
  await expect(page.getByTestId("client-row")).toHaveCount(1, { timeout: 20_000 });
  await page.getByTestId("client-row").first().getByText(/Tommy/).first().click();
  await expect(page.getByTestId("client-profile-page")).toBeVisible({ timeout: 30_000 });

  // One menu, in the sidebar: person, sections with aria-current, no white card in the page.
  const aside = page.locator("aside");
  await expect(page.getByTestId("profile-section-menu")).toHaveCount(1);
  await expect(aside.getByTestId("profile-section-menu")).toBeVisible();
  await expect(aside.getByTestId("profile-sidebar-person")).toContainText(/Tommy Jones/i);
  await expect(aside.getByTestId("profile-sidebar-subline")).toContainText("DSI");
  await expect(aside.getByTestId("profile-section-overview")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("client-profile-back")).toBeHidden();
  await aside.getByTestId("profile-section-plans").click();
  await expect(page).toHaveURL(/section=plans/);
  await expect(aside.getByTestId("profile-section-plans")).toHaveAttribute("aria-current", "page");
  await expect(aside.getByTestId("profile-section-overview")).not.toHaveAttribute("aria-current", "page");
  await aside.getByTestId("profile-section-team").focus();
  await expect(aside.getByTestId("profile-section-team")).toBeFocused();

  // ← All clients: the list keeps its search; the main menu is back.
  await aside.getByTestId("client-profile-sidebar-back").click();
  await expect(page).toHaveURL(/\/dashboard\/clients\/?(\?|$)/);
  await expect(search).toHaveValue("Tommy");
  await expect(page.getByTestId("profile-section-menu")).toHaveCount(0);
  await expect(aside.locator('[data-tour^="nav."]').first()).toBeVisible();
});

test("phone: section pills above the profile; the drawer keeps the main menu", async ({ page }) => {
  await installHiveMocks(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/dashboard/clients/${CLIENTS.tommy.id}`, { waitUntil: "domcontentloaded" });
  await waitForDashboard(page);
  await expect(page.getByTestId("client-profile-page")).toBeVisible({ timeout: 30_000 });
  const menu = page.getByTestId("profile-section-menu");
  await expect(menu).toHaveCount(1);
  await expect(menu.locator("ul")).toHaveCSS("flex-direction", "row");
  await expect(page.getByTestId("client-profile-back")).toBeVisible();
  await menu.getByTestId("profile-section-contacts").click();
  await expect(page).toHaveURL(/section=contacts/);
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(390);
});

test("old ?tab= links land on the matching section", async ({ page }) => {
  await installHiveMocks(page);
  await page.goto(`/dashboard/clients/${CLIENTS.tommy.id}?tab=identity`, {
    waitUntil: "domcontentloaded",
  });
  await waitForDashboard(page);
  const pageRoot = page.getByTestId("client-profile-page");
  await expect(pageRoot).toHaveAttribute("data-active-section", "profile", { timeout: 30_000 });
  await expect(page).toHaveURL(/section=profile/);
  await expect(page.getByTestId("client-identity")).toBeVisible();
});
