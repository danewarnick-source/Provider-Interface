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
