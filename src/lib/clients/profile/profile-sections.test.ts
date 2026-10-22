import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENT_PROFILE_SECTIONS,
  CLIENT_SECTION_LABEL,
  clientSectionHref,
  clientSectionSearchValue,
  resolveClientSection,
  sectionForLegacyTab,
  visibleClientSections,
} from "./profile-sections.ts";

const ALL = { canMedical: true, canBilling: true, hasMoney: true };
const NONE = { canMedical: false, canBilling: false };

describe("client profile sections", () => {
  it("labels every section", () => {
    for (const s of CLIENT_PROFILE_SECTIONS) assert.ok(CLIENT_SECTION_LABEL[s]);
    assert.equal(CLIENT_SECTION_LABEL.services, "Services & billing");
  });

  it("hides Health without Client medical and Services without Billing", () => {
    assert.deepEqual(visibleClientSections(ALL), [...CLIENT_PROFILE_SECTIONS]);
    const shown = visibleClientSections(NONE);
    assert.ok(!shown.includes("health"));
    assert.ok(!shown.includes("services"));
    assert.ok(shown.includes("contacts"));
  });

  it("shows Money only with Billing and money on file", () => {
    assert.ok(visibleClientSections(ALL).includes("money"));
    assert.ok(!visibleClientSections({ ...ALL, hasMoney: false }).includes("money"));
    assert.ok(!visibleClientSections({ canMedical: true, canBilling: true }).includes("money"));
    assert.ok(!visibleClientSections({ ...NONE, hasMoney: true }).includes("money"));
    assert.equal(resolveClientSection("money", { ...ALL, hasMoney: false }), "overview");
  });

  it("falls back to Overview for unknown or hidden sections", () => {
    assert.equal(resolveClientSection("contacts", ALL), "contacts");
    assert.equal(resolveClientSection("services", NONE), "overview");
    assert.equal(resolveClientSection("nope", ALL), "overview");
    assert.equal(resolveClientSection(undefined, ALL), "overview");
  });

  it("maps the old ?tab= values to sections", () => {
    assert.equal(sectionForLegacyTab("identity"), "profile");
    assert.equal(sectionForLegacyTab("care-plan"), "plans");
    assert.equal(sectionForLegacyTab("billing"), "services");
    assert.equal(sectionForLegacyTab("funds"), "money");
    assert.equal(sectionForLegacyTab("client-file"), "file");
    assert.equal(sectionForLegacyTab("operations"), "team");
    assert.equal(sectionForLegacyTab("logs"), "activity");
    assert.equal(sectionForLegacyTab("contacts"), "contacts");
    assert.equal(sectionForLegacyTab("bogus"), null);
    assert.equal(sectionForLegacyTab(undefined), null);
  });

  it("leaves Overview out of the URL", () => {
    assert.equal(clientSectionSearchValue("overview"), undefined);
    assert.equal(clientSectionSearchValue("file"), "file");
    assert.equal(clientSectionHref("c1", "overview"), "/dashboard/clients/c1");
    assert.equal(clientSectionHref("c1", "plans"), "/dashboard/clients/c1?section=plans");
  });
});
