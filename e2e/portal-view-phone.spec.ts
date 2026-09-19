/**
 * Phone-sized Portal View: open the hamburger Sheet and tap Staff View.
 * The menu is portaled to document.body; without pointer-events-auto the
 * tap hits the Sheet overlay (the page behind the painted menu).
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { installHiveMocks, screenshotPath } from "./helpers/admin-home-mock";

async function shot(page: Page, name: string) {
  try {
    fs.mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });
    await page.screenshot({ path: screenshotPath(name), fullPage: true });
  } catch {
    await page.screenshot({ path: `test-results/${name}.png`, fullPage: true }).catch(() => {});
  }
}

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  storageState: { cookies: [], origins: [] },
});

async function openPortalViewMenu(page: Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Loading workspace…")).toHaveCount(0, { timeout: 40_000 });
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Open menu" }).tap();
  // Desktop aside stays in the DOM (hidden md:flex). Use the open Sheet.
  const trigger = page.locator("[role='dialog']").getByTestId("portal-view-trigger");
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.tap();
  await expect(page.getByTestId("portal-view-menu")).toBeVisible();
  await shot(page, "portal_view_phone_menu_open");
}

test.describe("Portal View on a phone-sized viewport", () => {
  test.beforeEach(async ({ page }) => {
    await installHiveMocks(page, { role: "admin", isExecutive: true });
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem("hive.session-hint", "1");
      } catch {
        /* ignore */
      }
    });
  });

  test("Staff View tap hits the menu, not the page behind", async ({ page }) => {
    await openPortalViewMenu(page);
    await expect(page.getByTestId("portal-view-option-staff")).toBeVisible();
    await expect(page.getByTestId("portal-view-option-admin")).toBeVisible();
    // hive_exec is the same button; SSR executive check is not mocked here.

    await page.getByTestId("portal-view-option-staff").tap();

    await expect(page.getByTestId("portal-view-menu")).toHaveCount(0);
    const stored = await page.evaluate(() => window.localStorage.getItem("portal-view"));
    expect(stored).toBe("staff");
    await shot(page, "portal_view_phone_after_staff_tap");
  });

  test("Admin View is tappable after switching away", async ({ page }) => {
    await openPortalViewMenu(page);
    await page.getByTestId("portal-view-option-staff").tap();
    await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("portal-view"))).toBe(
      "staff",
    );

    // Staff phones use the avatar drawer, not the hamburger.
    await expect(page.getByRole("button", { name: "Open profile menu" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Open profile menu" }).tap();
    await page.locator("[role='dialog']").getByTestId("portal-view-trigger").tap();
    await page.getByTestId("portal-view-option-admin").tap();
    await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("portal-view"))).toBe(
      "admin",
    );
  });

  test("staff phone has no leftover search glass and tabs start at top", async ({ page }) => {
    await openPortalViewMenu(page);
    await page.getByTestId("portal-view-option-staff").tap();
    await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("portal-view"))).toBe(
      "staff",
    );

    await expect(page.getByRole("button", { name: "Open profile menu" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Open NECTAR search/i })).toHaveCount(0);
    await expect(page.locator("[data-staff-top-bar]")).toHaveCount(1);
    await expect(page.getByText(/form overdue/i)).toHaveCount(0);
    await expect(page.getByText(/CE hrs left/i)).toHaveCount(0);
    await expect(page.getByText(/Session Suspended/i)).toHaveCount(0);
    await expect(page.locator("[data-caseload-search]").first()).toBeVisible();
    await expect.poll(async () => page.locator("[data-caseload-search]").count()).toBe(1);

    const searchIcons = await page.evaluate(() => {
      return [...document.querySelectorAll("svg")].flatMap((svg) => {
        const r = svg.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return [];
        const cls = svg.getAttribute("class") ?? "";
        const isSearch = cls.includes("lucide-search") || cls.includes("search");
        if (!isSearch && r.x >= 8) return [];
        return [
          {
            cls,
            x: Math.round(r.x * 10) / 10,
            y: Math.round(r.y * 10) / 10,
            w: Math.round(r.width * 10) / 10,
            inField: !!svg.closest("[data-caseload-search]"),
          },
        ];
      });
    });
    const leftoverGlass = searchIcons.filter((i) => i.cls.includes("search") && i.x < 8);
    expect(leftoverGlass, `search icons: ${JSON.stringify(searchIcons)}`).toEqual([]);
    await shot(page, "staff_phone_caseload_no_leftover_glass");

    const scroller = page.locator("[data-staff-phone-scroller]");
    await expect(scroller).toBeVisible();
    await scroller.evaluate((el) => {
      const pad = document.createElement("div");
      pad.style.height = "1400px";
      pad.setAttribute("data-scroll-pad", "1");
      el.appendChild(pad);
      el.scrollTop = 320;
    });
    await expect.poll(async () => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await page.getByRole("link", { name: /^Daily Logs$/ }).tap();
    await expect.poll(async () => scroller.evaluate((el) => el.scrollTop)).toBe(0);
    await shot(page, "staff_phone_tab_dailylogs_from_top");
  });
});

type PhoneScrollReport = {
  ok: boolean;
  reason?: string;
  topClear?: boolean;
  bottomClear?: boolean;
  firstTop?: number;
  headerBottom?: number;
  probeBottom?: number;
  visibleBottom?: number;
  shellH?: number;
  innerH?: number;
  appVh?: string;
};

async function measurePhoneScroll(
  page: Page,
  opts: { scroller: string; header: string; bottomChrome?: string },
): Promise<PhoneScrollReport> {
  return page.evaluate(({ scroller, header, bottomChrome }) => {
    const s = document.querySelector(scroller) as HTMLElement | null;
    const h = document.querySelector(header) as HTMLElement | null;
    if (!s || !h) return { ok: false, reason: `missing ${!s ? "scroller" : "header"}` };

    if (!s.querySelector("[data-scroll-end-probe]")) {
      const spacer = document.createElement("div");
      spacer.setAttribute("data-scroll-spacer", "1");
      spacer.style.height = "1600px";
      const probe = document.createElement("div");
      probe.setAttribute("data-scroll-end-probe", "1");
      probe.style.height = "48px";
      probe.textContent = "end-probe";
      s.appendChild(spacer);
      s.appendChild(probe);
    }

    s.scrollTop = 0;
    const first = [...s.children].find((el) => {
      if (el.hasAttribute("data-scroll-spacer") || el.hasAttribute("data-scroll-end-probe")) {
        return false;
      }
      return (el as HTMLElement).getBoundingClientRect().height > 8;
    }) as HTMLElement | undefined;
    const headerBottom = h.getBoundingClientRect().bottom;
    const firstTop = first?.getBoundingClientRect().top ?? 0;

    const probe = s.querySelector("[data-scroll-end-probe]") as HTMLElement;
    s.scrollTop = s.scrollHeight;
    const probeBox = probe.getBoundingClientRect();
    const bottomEl = bottomChrome
      ? (document.querySelector(bottomChrome) as HTMLElement | null)
      : null;
    const visibleBottom = bottomEl
      ? bottomEl.getBoundingClientRect().top
      : s.getBoundingClientRect().bottom;

    return {
      ok: true,
      headerBottom,
      firstTop,
      topClear: firstTop >= headerBottom - 1,
      probeBottom: probeBox.bottom,
      visibleBottom,
      bottomClear: probeBox.bottom <= visibleBottom + 1,
      shellH: document.querySelector("[data-app-shell]")?.getBoundingClientRect().height ?? 0,
      innerH: window.innerHeight,
      appVh: getComputedStyle(document.documentElement).getPropertyValue("--app-vh").trim(),
    };
  }, opts);
}

test.describe("Phone shells can scroll from the first row to the last", () => {
  test.beforeEach(async ({ page }) => {
    await installHiveMocks(page, { role: "admin", isExecutive: true });
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem("hive.session-hint", "1");
      } catch {
        /* ignore */
      }
    });
  });

  async function openAdmin(page: Page, path: string) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Loading workspace…")).toHaveCount(0, { timeout: 40_000 });
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-dashboard-scroller]")).toBeVisible();
  }

  test("admin Home / Evidence / Employees keep first and last rows in the scrollport", async ({
    page,
  }) => {
    const routes = [
      { path: "/dashboard", shot: "admin_phone_home_scroll" },
      { path: "/dashboard/evidence", shot: "admin_phone_evidence_scroll" },
      { path: "/dashboard/employees", shot: "admin_phone_employees_scroll" },
    ] as const;

    for (const route of routes) {
      await openAdmin(page, route.path);
      const report = await measurePhoneScroll(page, {
        scroller: "[data-dashboard-scroller]",
        header: "header.hive-chrome",
      });
      expect(report.ok, `${route.path}: ${report.reason ?? ""}`).toBeTruthy();
      expect(report.topClear, `${route.path} first row under header ${JSON.stringify(report)}`).toBe(
        true,
      );
      expect(
        report.bottomClear,
        `${route.path} last row clipped at bottom ${JSON.stringify(report)}`,
      ).toBe(true);
      expect(report.shellH ?? 9999, `${route.path} shell taller than the viewport`).toBeLessThanOrEqual(
        (report.innerH ?? 0) + 1,
      );
      expect(report.appVh, `${route.path} missing --app-vh`).toMatch(/px$/);
      await shot(page, route.shot);
    }
  });

  test("staff phone Home keeps caseload above the tab bar after a full scroll", async ({
    page,
  }) => {
    await openPortalViewMenu(page);
    await page.getByTestId("portal-view-option-staff").tap();
    await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("portal-view"))).toBe(
      "staff",
    );
    await expect(page.locator("[data-staff-phone-scroller]")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-staff-top-bar]")).toBeVisible();

    const report = await measurePhoneScroll(page, {
      scroller: "[data-staff-phone-scroller]",
      header: "[data-staff-top-bar]",
      bottomChrome: "nav[aria-label='Primary']",
    });
    expect(report.ok, report.reason ?? "").toBeTruthy();
    expect(report.topClear, `staff first row under title bar ${JSON.stringify(report)}`).toBe(true);
    expect(report.bottomClear, `staff last row under tabs ${JSON.stringify(report)}`).toBe(true);
    await shot(page, "staff_phone_home_scroll_ends");
  });
});

test.describe("Staff employee phone after login (React 310 path)", () => {
  test.beforeEach(async ({ page }) => {
    await installHiveMocks(page, { role: "employee" });
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem("hive.session-hint", "1");
      } catch {
        /* ignore */
      }
    });
  });

  test("dashboard shell survives spinner to staff chrome", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Loading workspace…")).toHaveCount(0, { timeout: 40_000 });
    await expect(page.getByText("Something went wrong in the dashboard shell")).toHaveCount(0);
    await expect(page.getByText(/Minified React error #310/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open profile menu" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("[data-staff-top-bar]")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Open NECTAR search/i })).toHaveCount(0);
    await shot(page, "staff_employee_phone_after_login");
  });
});
