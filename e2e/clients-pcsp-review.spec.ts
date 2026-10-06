/**
 * Mocked e2e: Upload new PCSP → review → Confirm on a client's care plan.
 * readPcsp / confirmPcsp are mocked (e2e/helpers/pcsp-mock.ts) with the
 * made-up sample PCSP the unit test checks exactly. No PHI.
 */
import { test, expect } from "@playwright/test";
import { CLIENTS } from "./fixtures/tns-roster";
import { installHiveMocks, waitForDashboard } from "./helpers/mock-hive";

test.use({ storageState: { cookies: [], origins: [] } });

test("uploading the sample PCSP shows the review; nothing is written until Confirm", async ({ page }) => {
  await installHiveMocks(page);
  const writes: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    const body = req.postData() ?? "";
    if (/parseId/.test(body) && /edits/.test(body)) writes.push("confirmPcsp");
    if (req.method() !== "GET" && /\/rest\/v1\/(client_plans|client_goals|client_goal_supports|client_billing_codes|client_contacts|clients)\b/.test(url)) {
      writes.push(`${req.method()} ${url}`);
    }
  });

  await page.goto(`/dashboard/clients/${CLIENTS.tommy.id}`, { waitUntil: "domcontentloaded" });
  await waitForDashboard(page);
  await page.getByRole("tab", { name: /Care plan/i }).click();
  await page.getByRole("tab", { name: /^Goals$/i }).click();
  await expect(page.getByRole("button", { name: /Upload new PCSP/i })).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("pcsp-upload-input").setInputFiles({
    name: "sample-pcsp.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% made-up test file\n"),
  });

  const review = page.getByTestId("pcsp-review");
  await expect(review).toBeVisible({ timeout: 20_000 });
  await expect(review.getByText("Plan year Sep 1, 2026 – Aug 31, 2027")).toBeVisible();
  await expect(review.getByTestId("pcsp-review-goal")).toHaveCount(2);
  await expect(review.getByText(/1 continuing · 0 changed · 1 new/)).toBeVisible();
  await expect(review.getByText(/\$70,420\.00/)).toBeVisible();
  await expect(review.getByText(/Things to check \(6\)/)).toBeVisible();
  await expect(review.getByText("Page 5:")).toBeVisible();
  await expect(review.getByLabel("Code").first()).toHaveValue("DSI");
  await expect(review.getByText(/Sample Behavior Group Inc \(BC2\)/)).toBeVisible();
  expect(writes).toEqual([]);

  // Leaving out a goal is an edit on the review, not a write.
  await review.getByRole("checkbox", { name: "Keep this goal" }).nth(1).click();
  await expect(review.getByText(/1 continuing · 0 changed · 0 new/)).toBeVisible();
  expect(writes).toEqual([]);

  await review.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(/New plan year saved: 2 goals, 5 supports, 3 authorizations/)).toBeVisible({ timeout: 15_000 });
  await expect(review).toBeHidden();
  expect(writes).toEqual(["confirmPcsp"]);
});
