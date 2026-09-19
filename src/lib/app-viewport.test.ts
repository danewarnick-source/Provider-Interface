import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  APP_VH_VAR,
  APP_VT_VAR,
  APP_VIEWPORT_BOOT_SCRIPT,
  applyAppViewportVars,
  readVisibleViewportHeight,
  readVisibleViewportOffsetTop,
} from "./app-viewport.ts";

function read(rel: string) {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

describe("visible viewport math", () => {
  it("prefers visualViewport.height over innerHeight", () => {
    assert.equal(readVisibleViewportHeight({ height: 668 }, 844), 668);
  });

  it("falls back to innerHeight when visualViewport is missing", () => {
    assert.equal(readVisibleViewportHeight(null, 844), 844);
    assert.equal(readVisibleViewportHeight(undefined, 390), 390);
  });

  it("rejects non-positive visualViewport heights", () => {
    assert.equal(readVisibleViewportHeight({ height: 0 }, 800), 800);
    assert.equal(readVisibleViewportHeight({ height: Number.NaN }, 800), 800);
  });

  it("clamps a negative offsetTop to 0", () => {
    assert.equal(readVisibleViewportOffsetTop({ offsetTop: 47 }), 47);
    assert.equal(readVisibleViewportOffsetTop({ offsetTop: -12 }), 0);
    assert.equal(readVisibleViewportOffsetTop(null), 0);
  });

  it("writes --app-vh and --app-vt", () => {
    const props: Record<string, string> = {};
    const applied = applyAppViewportVars(
      { setProperty: (name, value) => {
        props[name] = value;
      } },
      { height: 668, offsetTop: 47 },
      844,
    );
    assert.deepEqual(applied, { height: 668, offsetTop: 47 });
    assert.equal(props[APP_VH_VAR], "668px");
    assert.equal(props[APP_VT_VAR], "47px");
  });
});

describe("shell wiring (source)", () => {
  it("boot script sets the same CSS variables before paint", () => {
    assert.match(APP_VIEWPORT_BOOT_SCRIPT, /--app-vh/);
    assert.match(APP_VIEWPORT_BOOT_SCRIPT, /--app-vt/);
    assert.match(APP_VIEWPORT_BOOT_SCRIPT, /visualViewport/);
  });

  it("root installs the boot script and the live visualViewport sync", () => {
    const root = read("../routes/__root.tsx");
    assert.match(root, /APP_VIEWPORT_BOOT_SCRIPT/);
    assert.match(root, /installAppViewportSync/);
    assert.match(root, /useLayoutEffect/);
  });

  it("admin dashboard shell uses data-app-shell and never h-screen", () => {
    const dash = read("../routes/dashboard.tsx");
    assert.match(dash, /data-app-shell/);
    assert.doesNotMatch(
      dash,
      /h-screen h-\[100dvh\]/,
      "h-screen (100vh) must not compete with the visible-viewport lock",
    );
    const shellOpen = dash.indexOf("data-app-shell");
    const shellClass = dash.slice(shellOpen, shellOpen + 280);
    assert.doesNotMatch(shellClass, /h-screen/);
    assert.doesNotMatch(shellClass, /100vh/);
  });

  it("staff phone shell sizes from --app-vh, not 100dvh/100vh", () => {
    const shell = read("../components/staff-mobile/staff-mobile-shell.tsx");
    const open = shell.indexOf("data-app-shell");
    const markup = shell.slice(open, open + 220);
    assert.match(shell, /data-app-shell="fixed"/);
    assert.doesNotMatch(markup, /h-\[100dvh\]/);
    assert.doesNotMatch(markup, /h-screen/);
    assert.doesNotMatch(markup, /100vh/);
  });

  it("CSS sizes app shells with svh/--app-vh and locks document scroll", () => {
    const css = read("../styles.css");
    assert.match(css, /\[data-app-shell\]/);
    assert.match(css, /100svh/);
    assert.match(css, /var\(--app-vh/);
    assert.match(css, /html:has\(\[data-app-shell\]\)/);
    assert.match(css, /overflow:\s*hidden/);
    const shellBlock = css.slice(css.indexOf("[data-app-shell]"), css.indexOf("[data-app-shell]") + 900);
    assert.doesNotMatch(shellBlock, /100vh/);
  });

  it("mobile dashboard scroller keeps a Safari-chrome bottom pad", () => {
    const css = read("../styles.css");
    assert.match(
      css,
      /\[data-dashboard-scroller\][\s\S]{0,180}safe-area-inset-bottom/,
    );
    assert.match(css, /2\.75rem \+ env\(safe-area-inset-bottom/);
  });

  it("public marketing pages use svh min-height and a safe-area footer pad", () => {
    const home = read("../components/pi-landing/pi-homepage.css");
    const landing = read("../components/pi-landing/pi-landing.css");
    assert.match(home, /min-height:\s*100svh/);
    assert.match(landing, /min-height:\s*100svh/);
    assert.match(landing, /\.pi-pub-foot[\s\S]{0,220}safe-area-inset-bottom/);
    assert.match(home, /\.pi-home-foot[\s\S]{0,220}safe-area-inset-bottom/);
  });
});
