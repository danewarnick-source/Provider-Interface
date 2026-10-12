import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PI_PUBLIC_NAV } from "./pi-homepage.ts";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const PUBLIC_SHELL_FILES = [
  "../routes/contact.tsx",
  "../routes/pricing.tsx",
  "../components/pi-landing/pi-nectar-page.tsx",
  "../components/pi-landing/pi-about-page.tsx",
  "../routes/terms.tsx",
  "../routes/privacy.tsx",
  "../routes/baa.tsx",
  "../routes/login.tsx",
  "../routes/signup.tsx",
] as const;

describe("public pages share homepage marketing chrome", () => {
  it("keeps one homepage nav order for every non-home public page", () => {
    assert.deepEqual(
      PI_PUBLIC_NAV.map((item) => `${item.label}:${item.to}`),
      ["Nectar:/nectar", "Pricing:/pricing", "About:/about"],
    );
  });

  it("routes Contact, legal, and auth through PiPublicPage", () => {
    for (const rel of PUBLIC_SHELL_FILES) {
      const text = read(rel);
      assert.match(text, /PiPublicPage/, `${rel} must use PiPublicPage`);
      assert.equal(
        text.includes('from "@/components/site-header"'),
        false,
        `${rel} must not use SiteHeader`,
      );
      assert.equal(
        text.includes('from "@/components/landing/footer"'),
        false,
        `${rel} must not use landing Footer`,
      );
    }
    const forgot = read("../routes/forgot-password.tsx");
    assert.match(forgot, /AuthShell/);
    assert.equal(forgot.includes('from "@/components/site-header"'), false);
  });

  it("header and footer cannot drift from homepage chrome", () => {
    const header = read("../components/pi-landing/pi-public-header.tsx");
    const footer = read("../components/pi-landing/pi-public-footer.tsx");
    const page = read("../components/pi-landing/pi-public-page.tsx");
    assert.match(header, /pi-home-nav/);
    assert.match(header, /pi-home-btn primary sm/);
    assert.match(page, /denim-field/);
    assert.match(header, /PI_PUBLIC_NAV/);
    assert.match(header, /PI_HOME_NAV/);
    assert.match(footer, /pi-home-foot/);
    assert.match(footer, /PI_HOME_FOOTER_LINKS/);
    assert.match(footer, /PI_HOME_FOOTER_HCBS/);
    assert.match(page, /pi-landing-root pi-home/);
    assert.match(page, /applyPublicPageScroll/);
    assert.match(header, /hash=""/);
    assert.match(footer, /hash=""/);
    assert.doesNotMatch(header, /btn p sm/);
    assert.doesNotMatch(footer, /PI_FOOTER_LINKS/);
  });

  it("keeps gold, cream, and the old navy off public marketing CSS", () => {
    const homeCss = read("../components/pi-landing/pi-homepage.css");
    const landingCss = read("../components/pi-landing/pi-landing.css");
    for (const css of [homeCss, landingCss]) {
      assert.doesNotMatch(css, /#c4a35a|#d9c284|#c9a227|#f3efe6|#0a1120|#0a0f1c/i);
      assert.doesNotMatch(css, /gold|cream/i);
      assert.doesNotMatch(css, /Newsreader|Iowan/);
    }
    assert.match(landingCss, /backdrop-filter: saturate\(1\.6\) blur\(18px\)/);
    assert.match(landingCss, /border-radius: 999px/);
    assert.match(homeCss, /background: var\(--denim-deep\)/);
    const signup = read("../routes/signup.tsx");
    assert.doesNotMatch(signup, /#3a4553/);
    assert.doesNotMatch(signup, /rgba\(255,255,255,0\.5\)/);
    const contact = read("../components/landing/contact.tsx");
    assert.doesNotMatch(contact, /bg-\[color:var\(--surface-2\)\]/);
    assert.doesNotMatch(contact, /careacademy/);
    assert.match(contact, /pi-home-btn primary/);
    assert.match(contact, /pi-home-card/);
    assert.doesNotMatch(contact, /gold|cream/);
  });

  it("keeps Sign in on the paper auth surface as the Denim primary pill", () => {
    const login = read("../routes/login.tsx");
    const forgot = read("../routes/forgot-password.tsx");
    const homeCss = read("../components/pi-landing/pi-homepage.css");
    assert.match(login, /pi-home-btn primary/);
    assert.match(login, /pi-home-card/);
    assert.doesNotMatch(login, /pi-home-btn gold|cream-card/);
    assert.match(forgot, /pi-home-btn primary/);
    assert.match(homeCss, /\.pi-home-btn\.primary \{/);
    assert.match(homeCss, /background: var\(--denim-pri\)/);
    assert.match(homeCss, /\.pi-home-card \{[\s\S]*border-radius: 20px[\s\S]*box-shadow: var\(--denim-shadow\)/);
  });
});
