import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("NECTAR onboarding — agency setup gate, no Home wizard", () => {
  it("does not require SOW upload or document_upload attestation to finish setup", () => {
    const hook = read("../hooks/use-onboarding-progress.tsx");
    const banner = read("../components/onboarding/onboarding-guidance-banner.tsx");

    assert.doesNotMatch(hook, /sowCount/);
    assert.doesNotMatch(hook, /attestationCount/);
    assert.doesNotMatch(hook, /document_upload/);
    assert.doesNotMatch(hook, /authoritative_kind/);

    assert.doesNotMatch(banner, /Once your SOW is uploaded/);
    assert.doesNotMatch(banner, /State Scope of Work/);
    assert.match(banner, /You do not need to upload a Scope of Work to finish setup/);
    assert.match(banner, /Optional checklist — does not unlock create/);
    assert.doesNotMatch(banner, /Setup step \{step\}/);
    assert.match(banner, /NEVER calculates setup eligibility/);
    assert.doesNotMatch(hook, /localStorage\.|onboardingLSKey\(|profile_saved:/);
    assert.match(hook, /useAgencySetup/);
  });

  it("keeps the company documents hub as optional storage, not a SOW gate", () => {
    const docs = read("../components/pages/nectar-docs-page.tsx");
    const bar = read("../components/onboarding/onboarding-return-bar.tsx");
    assert.match(bar, /useAgencySetup/);
    assert.match(bar, /AGENCY_SETUP_PATH/);
    assert.doesNotMatch(bar, /useOnboardingProgress/);
    assert.match(docs, /OnboardingGuidanceBanner step=\{5\}/);
    assert.doesNotMatch(docs, /Upload a PCSP, SOW or certification to seed NECTAR/);
    assert.match(docs, /when you have files to store/);
  });

  it("does not mount the agency-setup wizard on Admin Home", () => {
    const dash = read("../components/admin-home/admin-home-dashboard.tsx");
    assert.doesNotMatch(dash, /NectarOnboardingPanel/);
    assert.doesNotMatch(dash, /nectar-onboarding-panel/);
    assert.doesNotMatch(dash, /agency-setup-panel/);
    assert.doesNotMatch(dash, /RequirePermission/);
  });
});
