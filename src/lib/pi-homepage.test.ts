import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  PI_HOME_BODY_BG,
  PI_HOME_BTN_RADIUS,
  PI_HOME_DSP_CAPTION,
  PI_HOME_FEATURES,
  PI_HOME_FOOTER_HCBS,
  PI_HOME_FOOTER_LINKS,
  PI_HOME_ACCENT,
  PI_HOME_ACCENT_SOFT,
  PI_HOME_GUTTER_PX,
  PI_HOME_H1_BUILT,
  PI_HOME_H1_FOR,
  PI_HOME_H1_LEAD,
  PI_HOME_H1_MID,
  PI_HOME_H1_TAIL,
  PI_HOME_H1_TO,
  PI_HOME_HERO_FINE,
  PI_HOME_MAX_WIDTH,
  PI_HOME_NAV,
  PI_PUBLIC_NAV,
  PI_HOME_NAV_BREAKPOINT,
  PI_HOME_NAVY,
  PI_HOME_PHONE_ROWS,
  PI_HOME_PRICING_HEADLINE,
  PI_HOME_SEE_IT,
  PI_HOME_DISPLAY,
  PI_HOME_PRIMARY_BTN,
  PI_HOME_START_SIGNUP,
  PI_HOME_UTAH_LINE,
} from "./pi-homepage.ts";
import { DENIM } from "./design-tokens.ts";
import { PI_THEME } from "./pi-theme.ts";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("public homepage tokens are Denim", () => {
  it("locks the public homepage palette to Denim", () => {
    assert.equal(PI_HOME_NAVY, DENIM.deep);
    assert.equal(PI_HOME_ACCENT, DENIM.acc);
    assert.equal(PI_HOME_ACCENT_SOFT, DENIM.acct);
    assert.equal(PI_HOME_PRIMARY_BTN, DENIM.pri);
    assert.equal(PI_HOME_MAX_WIDTH, 1240);
    assert.equal(PI_HOME_BTN_RADIUS, 999);
    assert.equal(PI_HOME_NAV_BREAKPOINT, 820);
    assert.equal(PI_HOME_GUTTER_PX, 32);
    assert.match(PI_HOME_DISPLAY, /Manrope/);
    assert.equal(PI_HOME_BODY_BG, DENIM.bg);
    assert.equal(PI_HOME_NAVY, PI_THEME.navy);
  });

  it("keeps the Utah providers line as written and omits a stats strip", () => {
    assert.equal(PI_HOME_UTAH_LINE, "Built for Utah Medicaid disability providers");
    assert.match(PI_HOME_DSP_CAPTION, /Direct support professionals/);
    assert.equal(PI_HOME_SEE_IT, "See it in 10 minutes");
    assert.equal(PI_HOME_START_SIGNUP, "Start signup");
    assert.equal(PI_HOME_PRICING_HEADLINE, "One number. Whole platform.");
    assert.equal(PI_HOME_H1_LEAD, "You focus on what's important");
    assert.equal(PI_HOME_H1_TO, "to");
    assert.equal(PI_HOME_H1_MID, "your business,");
    assert.equal(PI_HOME_H1_BUILT, "We focus on what's important");
    assert.equal(PI_HOME_H1_FOR, "for");
    assert.equal(PI_HOME_H1_TAIL, "your business");
    assert.equal(
      `${PI_HOME_H1_LEAD} ${PI_HOME_H1_TO} ${PI_HOME_H1_MID} ${PI_HOME_H1_BUILT} ${PI_HOME_H1_FOR} ${PI_HOME_H1_TAIL}`,
      "You focus on what's important to your business, We focus on what's important for your business",
    );
    assert.equal(PI_HOME_HERO_FINE, "$69/client · $350 min");
    assert.equal(PI_HOME_PHONE_ROWS.length, 5);
    assert.deepEqual(
      PI_HOME_FEATURES.map((row) => row.id),
      ["notes", "nectar", "training"],
    );
    assert.match(PI_HOME_FOOTER_HCBS, /home and community-based services/i);
    assert.doesNotMatch(PI_HOME_FOOTER_HCBS, /Utah|DSPD/);
    assert.deepEqual(
      PI_HOME_NAV.map((item) => item.label),
      ["Nectar", "Training", "Pricing", "About"],
    );
    assert.deepEqual(
      PI_PUBLIC_NAV.map((item) => item.label),
      ["Nectar", "Pricing", "About"],
    );
    assert.deepEqual(
      PI_PUBLIC_NAV.map((item) => item.to),
      ["/nectar", "/pricing", "/about"],
    );
    assert.deepEqual(
      PI_HOME_FOOTER_LINKS.map((item) => item.to),
      ["/privacy", "/terms", "/contact"],
    );
  });

  it("wires real routes and never uses an empty hash", () => {
    const landing = read("../components/pi-landing/pi-marketing-page.tsx");
    const header = read("../components/pi-landing/pi-public-header.tsx");
    const footer = read("../components/pi-landing/pi-public-footer.tsx");
    const css = read("../components/pi-landing/pi-homepage.css");
    const theme = read("./pi-theme.ts");
    assert.match(landing, /to="\/contact"/);
    assert.match(landing, /to="\/signup"/);
    assert.match(header, /to="\/login"/);
    assert.match(header, /hash=\{item.hash\}/);
    assert.match(footer, /PI_HOME_FOOTER_LINKS/);
    assert.doesNotMatch(landing, /href="#"/);
    assert.doesNotMatch(header, /href="#"/);
    assert.doesNotMatch(footer, /href="#"/);
    assert.doesNotMatch(landing, /PI_HERO_STATS|className="strip"/);
    assert.match(css, /var\(--denim-bg\)/);
    assert.match(css, /max-width: 1240px/);
    assert.match(css, /border-radius: 999px/);
    assert.match(css, /border-radius: 34px/);
    assert.match(css, /max-width: 819px/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /var\(--font-display\)/);
    assert.doesNotMatch(css, /#c4a35a|#d9c284|#0a0f1c|gold|cream|Iowan Old Style|Inter"/);
    assert.doesNotMatch(theme, /#0a0f1c/);
    assert.doesNotMatch(theme, /#c4a35a/);
  });

  it("uses Denim pills and keeps mid-page sections inset on mobile", () => {
    const css = read("../components/pi-landing/pi-homepage.css");
    const landing = read("../components/pi-landing/pi-landing.css");
    assert.match(css, /--home-inset: max\(32px/);
    assert.match(css, /\.pi-home\.pi-landing-root \.pi-home-feature/);
    assert.match(css, /padding-left: var\(--home-inset\)/);
    assert.match(css, /padding-right: var\(--home-inset-end\)/);
    assert.match(css, /\.pi-home-btn\.primary \{[\s\S]*background: var\(--denim-pri\)/);
    assert.match(css, /\.pi-home\.pi-landing-root h1 em/);
    assert.match(css, /color: var\(--denim-acc\)/);
    assert.doesNotMatch(css, /-webkit-text-fill-color/);
    assert.match(landing, /\.pi-landing-root:not\(\.pi-home\) section/);
    assert.doesNotMatch(landing, /^\.pi-landing-root section \{$/m);
  });
});
