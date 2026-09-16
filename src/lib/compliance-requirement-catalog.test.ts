import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  layerForSowEntry,
  platformRequirementDefs,
  requirementKeyForClientTrainingType,
  requirementKeyForInHiveCourse,
  resolveLockedSowEntry,
  subjectKindForSowEntry,
} from "./compliance-requirement-catalog.ts";
import { sowCatalogEntryByKey } from "./sow-obligation-catalog.ts";
import { TRANSPORT_OPT_OUT_FACT_KEY } from "./compliance-store.ts";

describe("compliance requirement catalog", () => {
  const defs = platformRequirementDefs();
  const byKey = new Map(defs.map((row) => [row.requirementKey, row]));

  it("seeds the locked trackable SOW set and skips retired / by_design", () => {
    assert.equal(defs.length, 132);
    assert.ok(byKey.has("orientation_30_day"));
    assert.ok(byKey.has("driving_record_transport"));
    assert.ok(byKey.has("client_specific_training"));
    assert.ok(byKey.has("em_bcp_plan"));
    assert.equal(byKey.has("pct_client"), false);
    assert.equal(byKey.has("evv_visit_verification"), false);
    assert.equal(byKey.has("timesheets_attendance"), false);
  });

  it("assigns the layered SOW model", () => {
    assert.equal(byKey.get("orientation_30_day")?.layer, "all_staff_clock");
    assert.equal(byKey.get("educational_credentials")?.layer, "staff_shelf");
    assert.equal(byKey.get("driving_record_transport")?.layer, "staff_exception");
    assert.equal(byKey.get("driving_record_transport")?.gateFactKey, TRANSPORT_OPT_OUT_FACT_KEY);
    assert.equal(byKey.get("driving_record_transport")?.defaultOn, true);
    assert.equal(byKey.get("client_specific_training")?.layer, "client_shelf");
    assert.equal(byKey.get("client_specific_training")?.subjectKind, "client");
    assert.equal(byKey.get("em_bcp_plan")?.layer, "company_standing");
    assert.equal(byKey.get("hhs_home_cert_annual")?.subjectKind, "site");
  });

  it("maps in-hive courses and client trainings to catalog keys", () => {
    assert.equal(requirementKeyForInHiveCourse("thirty-day"), "orientation_30_day");
    assert.equal(requirementKeyForInHiveCourse("abi"), "abi_training");
    assert.equal(
      requirementKeyForInHiveCourse("pi-person-centered-foundations"),
      "pct_hire_practices",
    );
    assert.equal(requirementKeyForInHiveCourse("pi-annual-ce-12hr"), null);
    assert.equal(requirementKeyForClientTrainingType("person_specific"), "client_specific_training");
    assert.equal(requirementKeyForClientTrainingType("support_strategies"), "support_strategies");
    assert.equal(requirementKeyForClientTrainingType("person_centered"), null);
  });

  it("resolves only trackable locked SOW rows", () => {
    assert.equal(resolveLockedSowEntry({ key: "orientation_30_day" })?.key, "orientation_30_day");
    assert.equal(resolveLockedSowEntry({ title: "Background Screening — Annual" })?.key, "background_screening_annual");
    assert.equal(resolveLockedSowEntry({ key: "evv_visit_verification" }), null);
    const evv = sowCatalogEntryByKey("evv_visit_verification");
    assert.ok(evv);
    assert.equal(layerForSowEntry(evv), "company_standing");
    assert.equal(subjectKindForSowEntry(evv), "org");
  });

  it("seed SQL matches catalog keys and is additive", () => {
    const sql = readFileSync(
      new URL("../../supabase/migrations/20260916140000_seed_platform_requirement_defs.sql", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/);
    assert.match(sql, /INSERT INTO public\.requirement_defs/);
    assert.match(sql, /ON CONFLICT \(requirement_key\) WHERE organization_id IS NULL/);
    for (const row of defs) {
      assert.match(sql, new RegExp(`'${row.requirementKey}'`));
    }
    assert.match(sql, /does_not_transport/);
  });
});
