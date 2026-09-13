import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("NECTAR onboarding — no SOW upload gate", () => {
  it("does not require SOW upload or document_upload attestation to finish setup", () => {
    const hook = read("../hooks/use-onboarding-progress.tsx");
    const panel = read("../components/onboarding/nectar-onboarding-panel.tsx");
    const banner = read("../components/onboarding/onboarding-guidance-banner.tsx");

    assert.doesNotMatch(hook, /sowCount/);
    assert.doesNotMatch(hook, /attestationCount/);
    assert.doesNotMatch(hook, /document_upload/);
    assert.doesNotMatch(hook, /authoritative_kind/);
    assert.match(hook, /totalSteps = 4/);
    assert.match(hook, /c\.profileSaved \|\| profileSaved/);
    assert.match(hook, /c\.memberCount > 1/);
    assert.match(hook, /c\.clientCount > 0/);
    assert.match(hook, /c\.serviceCodesCount > 0/);

    assert.doesNotMatch(panel, /AuthoritativeSourceDrop/);
    assert.doesNotMatch(panel, /AttestationBanner/);
    assert.doesNotMatch(panel, /state_sow/);
    assert.doesNotMatch(panel, /Complete Step 1 first/);
    assert.doesNotMatch(panel, /locked: !step1Complete/);
    assert.match(panel, /Company documents \(optional\)/);
    assert.match(panel, /required: false/);
    assert.match(panel, /you do not upload a Scope of Work to finish setup/);
    assert.doesNotMatch(panel, /Hive Certify|Hive Platform/);
    assert.doesNotMatch(panel, /[\u{1F300}-\u{1FAFF}]/u);

    assert.doesNotMatch(banner, /Once your SOW is uploaded/);
    assert.doesNotMatch(banner, /State Scope of Work/);
    assert.match(banner, /You do not need to upload a Scope of Work to finish setup/);
  });

  it("keeps the company documents hub as optional storage, not a SOW gate", () => {
    const docs = read("../components/pages/nectar-docs-page.tsx");
    assert.match(docs, /OnboardingGuidanceBanner step=\{5\}/);
    assert.doesNotMatch(docs, /Upload a PCSP, SOW or certification to seed NECTAR/);
    assert.match(docs, /when you have files to store/);
  });

  it("mounts the wizard on Admin Home when an org is loaded, without RequirePermission", () => {
    const dash = read("../components/admin-home/admin-home-dashboard.tsx");
    assert.match(dash, /NectarOnboardingPanel/);
    assert.match(dash, /orgId \? <NectarOnboardingPanel/);
    assert.doesNotMatch(dash, /RequirePermission/);
  });
});
