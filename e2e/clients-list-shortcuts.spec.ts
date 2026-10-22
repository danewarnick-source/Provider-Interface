/**
 * Mocked e2e: an empty cell's shortcut on the Clients list lands on the field
 * that fixes it. "+ Set home" opens the Identity editor with Home focused;
 * saving drops ?edit= and the list shows the new home. Made-up fixtures only.
 */
import { test, expect } from "@playwright/test";
import { CLIENTS } from "./fixtures/tns-roster";
import { installHiveMocks, waitForDashboard } from "./helpers/mock-hive";

test.use({ storageState: { cookies: [], origins: [] } });

test("+ Set home opens the Home field, and the saved home shows on the list", async ({ page }) => {
  await installHiveMocks(page, { persona: "admin" });
  await page.goto("/dashboard/clients", { waitUntil: "domcontentloaded" });
  await waitForDashboard(page);

  // Marcus Rivera has no home in the fixture.
  const row = () => page.locator("table tr").filter({ hasText: "Marcus Rivera" });
  await expect(row()).toBeVisible({ timeout: 20_000 });
  await row().getByRole("link", { name: "+ Set home" }).click();

  await page.waitForURL(new RegExp(`/dashboard/clients/${CLIENTS.marcus.id}\\?.*edit=home`));
  const home = page.locator("#client-home");
  await expect(home).toBeVisible({ timeout: 20_000 });
  await expect(home).toBeFocused();

  await expect(home.locator("option", { hasText: "Oak SLH" })).toHaveCount(1);
  await home.selectOption({ label: "Oak SLH" });
  await page.getByRole("button", { name: "Save identity" }).click();
  await expect(home).toHaveCount(0);
  await expect(page).not.toHaveURL(/edit=/);

  await page.getByTestId("client-profile-sidebar-back").first().click();
  await page.waitForURL(/\/dashboard\/clients(\?|$)/);
  await expect(row()).toBeVisible({ timeout: 20_000 });
  await expect(row().getByText("Oak SLH", { exact: true })).toBeVisible();
  await expect(row().getByRole("link", { name: "+ Set home" })).toHaveCount(0);
});
