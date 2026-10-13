import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { citationSection, proposeCatalogRelation } from "./catalog-relation.ts";

describe("proposeCatalogRelation", () => {
  it("matches exact catalog titles", () => {
    const got = proposeCatalogRelation({
      title: "CPR/First Aid Certification — Initial",
      source_citation: "DHHS91172 SOW §1.8(5)",
    });
    assert.equal(got.kind, "match");
    assert.equal(got.catalog_key, "cpr_first_aid_initial");
    assert.equal(got.confidence, "alias");
  });

  it("matches leftover CPR and CST title aliases", () => {
    const cpr = proposeCatalogRelation({ title: "CPR & First Aid Certification" });
    assert.equal(cpr.kind, "match");
    assert.equal(cpr.catalog_key, "cpr_first_aid_initial");

    const cst = proposeCatalogRelation({ title: "Client-Specific Training" });
    assert.equal(cst.kind, "match");
    assert.equal(cst.catalog_key, "client_specific_training");
  });

  it("matches a requirement_key to BY_KEY", () => {
    const got = proposeCatalogRelation({
      title: "Agency-specific CPR packet label",
      requirement_key: "cpr_first_aid_initial",
    });
    assert.equal(got.kind, "match");
    assert.equal(got.catalog_key, "cpr_first_aid_initial");
    assert.equal(got.confidence, "exact");
  });

  it("overlays agency wording that shares a catalog citation", () => {
    const got = proposeCatalogRelation({
      title: "Initial cardiopulmonary resuscitation and first aid card",
      description: "Staff must hold a current CPR and first aid card before working alone.",
      source_citation: "State SOW addendum — §1.8(5)",
    });
    assert.equal(got.kind, "overlay");
    assert.equal(got.catalog_key, "cpr_first_aid_initial");
    assert.equal(got.confidence, "citation");
    assert.ok(got.overlay);
    assert.equal(got.overlay?.catalog_title.includes("CPR"), true);
  });

  it("conflicts when a close title cites a different section", () => {
    const got = proposeCatalogRelation({
      title: "30-Day New Hire Orientation Training packet",
      source_citation: "Agency handbook — §9.9(9)",
    });
    assert.equal(got.kind, "conflict");
    assert.equal(got.catalog_key, "orientation_30_day");
    assert.match(got.rationale, /disagrees/);
  });

  it("conflicts when two catalog keys score as counterparts", () => {
    const got = proposeCatalogRelation({
      title: "CPR/First Aid Certification Initial Renewal",
      description: "Initial and renewal cardiopulmonary first aid certification.",
    });
    assert.equal(got.kind, "conflict");
    assert.equal(got.catalog_key, null);
    assert.match(got.rationale, /Ambiguous/);
  });

  it("conflicts when the agency source has no catalog counterpart", () => {
    const got = proposeCatalogRelation({
      title: "Custom Agency Handbook Review",
      description: "Internal style guide for the employee newsletter.",
      source_citation: "Provider policy 2024",
    });
    assert.equal(got.kind, "conflict");
    assert.equal(got.catalog_key, null);
    assert.match(got.rationale, /No catalog counterpart/);
    assert.equal(got.confidence, "none");
  });

  it("conflicts on an empty title", () => {
    const got = proposeCatalogRelation({ title: "   " });
    assert.equal(got.kind, "conflict");
    assert.equal(got.catalog_key, null);
  });

  it("matches a training title with no overlay", () => {
    const proposal = proposeCatalogRelation({
      title: "Person-Centered Thinking and Practices Training",
    });
    assert.equal(proposal.kind, "match");
    assert.equal(proposal.catalog_key, "pct_hire_practices");
    assert.equal(proposal.overlay, null);
  });
});

describe("citation helpers", () => {
  it("pulls § sections from intake and catalog citations", () => {
    assert.equal(citationSection("DHHS91172 SOW §1.8(5)"), "1 8 5");
    assert.equal(citationSection("Addendum — §1.25"), "1 25");
    assert.equal(citationSection("no section here"), null);
  });

  it("keeps the Step 7 module pure and emoji-free now that its writer is gone (N2)", () => {
    const src = readFileSync(new URL("./catalog-relation.ts", import.meta.url), "utf8");
    assert.equal(/\p{Extended_Pictographic}/u.test(src), false);
    assert.doesNotMatch(src, /supabase|createServerFn/);
    assert.doesNotMatch(src, /catalog-relation\.functions/);
  });
});
