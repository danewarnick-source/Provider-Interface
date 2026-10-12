import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DENIM, DENIM_FONTS } from "./design-tokens.ts";
import { PI_THEME } from "./pi-theme.ts";
import { PI_ACCENT, PI_ACTION, PI_PAPER, PI_NAVY, PI_THEME as FROM_LANDING } from "./pi-landing.ts";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("PI theme tokens", () => {
  it("locks the token object to Denim", () => {
    assert.equal(PI_THEME.navy, DENIM.deep);
    assert.equal(PI_THEME.navy, "#1B3350");
    assert.equal(PI_THEME.n1, DENIM.pri);
    assert.equal(PI_THEME.n2, DENIM.pt);
    assert.equal(PI_THEME.n3, DENIM.pt2);
    assert.equal(PI_THEME.sideTop, DENIM.deep);
    assert.equal(PI_THEME.paper, DENIM.paper);
    assert.equal(PI_THEME.c70, DENIM.text);
    assert.equal(PI_THEME.c50, DENIM.muted);
    assert.equal(PI_THEME.c08, DENIM.line);
    assert.equal(PI_THEME.accent, DENIM.acc);
    assert.equal(PI_THEME.ok, DENIM.acc);
    assert.equal(PI_THEME.red, "#D92D20");
    assert.equal(PI_THEME.warnText, "#B54708");
    assert.equal(PI_THEME.heading, DENIM_FONTS.heading);
    assert.equal(PI_THEME.sans, DENIM_FONTS.body);
    assert.equal(PI_THEME.grainOpacity, 0);
    assert.equal(PI_THEME.cardBg, DENIM.paper);
    assert.equal(PI_THEME.heroTileBg, "var(--denim-band)");
    assert.equal(PI_THEME.buttons.primaryBg, DENIM.pri);
    assert.equal(PI_THEME.buttons.primaryFg, DENIM.paper);
    assert.match(PI_THEME.shadow2, /rgba\(27, 51, 80/);
    assert.doesNotMatch(JSON.stringify(PI_THEME), /rgba\(0, 0, 0|#c9a227|#f3efe6|Newsreader|Inter/);
  });

  it("re-exports from pi-landing so landing and app cannot drift", () => {
    assert.equal(FROM_LANDING, PI_THEME);
    assert.equal(PI_NAVY, PI_THEME.navy);
    assert.equal(PI_PAPER, PI_THEME.paper);
    assert.equal(PI_ACCENT, DENIM.acc);
    assert.equal(PI_ACTION, DENIM.pri);
  });

  it("has no grain overlay on the public CSS", () => {
    const css = read("../components/pi-landing/pi-landing.css");
    assert.doesNotMatch(css, /feTurbulence/);
    assert.doesNotMatch(css, /mix-blend-mode: overlay/);
    assert.match(css, /var\(--denim-bg\)/);
  });

  it("loads Figtree + Manrope on the root font link", () => {
    const root = read("../routes/__root.tsx");
    assert.match(root, /family=Figtree/);
    assert.match(root, /family=Manrope/);
    assert.doesNotMatch(root, /family=Newsreader/);
  });
});
