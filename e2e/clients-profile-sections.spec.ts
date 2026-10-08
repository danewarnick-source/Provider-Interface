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
