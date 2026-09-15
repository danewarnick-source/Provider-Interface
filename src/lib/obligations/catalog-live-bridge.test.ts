import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXPLICIT_REQ_TO_LIVE_KEY,
  filterDuplicateElementTasks,
  liveObligationKeyForRequirement,
  staffTaskPolicy,
} from "./catalog-live-bridge.ts";
import { sowCatalogEntryByKey } from "../sow-obligation-catalog.ts";

describe("catalog live bridge", () => {
  it("maps imported parents onto existing live keys — no second checklist", () => {
    assert.equal(liveObligationKeyForRequirement("REQ-1.8.4"), "orientation_30_day");
    assert.equal(liveObligationKeyForRequirement("REQ-1.8.8"), "abi_training");
    assert.equal(liveObligationKeyForRequirement("REQ-1.10.7"), "timesheets_attendance");
    assert.equal(liveObligationKeyForRequirement("REQ-1.12"), "evv_visit_verification");
    assert.equal(liveObligationKeyForRequirement("REQ-1.30"), "driving_record_transport");
    assert.equal(liveObligationKeyForRequirement("REQ-28.4"), "acre_sed");
    assert.equal(liveObligationKeyForRequirement("REQ-30.6.a"), "usor_job_coaching_sei");
    assert.equal(liveObligationKeyForRequirement("REQ-33.5.b"), "acre_sjd");
    assert.equal(liveObligationKeyForRequirement("REQ-33.5.c"), "customized_employment_usu");
    assert.equal(liveObligationKeyForRequirement("REQ-30.3.4"), "sei_monthly_summary_upi");
    assert.equal(liveObligationKeyForRequirement("REQ-32.3.2"), "cmp_cms_monthly_summaries");
    assert.equal(liveObligationKeyForRequirement("REQ-33.3.4"), "sjd_monthly_summary_upi");
    assert.equal(liveObligationKeyForRequirement("REQ-30.3.5"), "sei_employment_data_upi");
    assert.equal(liveObligationKeyForRequirement("REQ-30.3.6"), "sei_employment_strategies_upi");
    assert.equal(liveObligationKeyForRequirement("REQ-33.3.5"), "sei_employment_strategies_upi");
    assert.equal(liveObligationKeyForRequirement("REQ-33.3.7"), "sjd_employment_data_upi");
    assert.equal(liveObligationKeyForRequirement("REQ-33.3.1"), "sjd_usor_contact_monthly");
    assert.equal(liveObligationKeyForRequirement("REQ-33.3.4.I"), "sjd_usor_contact_monthly");
    assert.equal(liveObligationKeyForRequirement("REQ-1.28.5"), "pba_financial_review");
    assert.equal(liveObligationKeyForRequirement("REQ-15.3.7"), "pba_financial_review");
    assert.equal(liveObligationKeyForRequirement("REQ-1.11"), "zoning_life_safety");
    assert.equal(liveObligationKeyForRequirement("REQ-1.22.c"), "person_discharge_process");
    assert.equal(liveObligationKeyForRequirement("REQ-1.28.7"), "emergency_loan_record");
    assert.equal(liveObligationKeyForRequirement("REQ-1.28.7.G"), "large_loan_disclosure_process");
    assert.equal(liveObligationKeyForRequirement("REQ-1.28.9"), "no_gifts_process");
    assert.equal(liveObligationKeyForRequirement("REQ-1.15.1"), "upi_form_0_9_designee");
    assert.equal(liveObligationKeyForRequirement("REQ-1.15.6"), "upi_1056_utilization");
    assert.equal(liveObligationKeyForRequirement("REQ-1.15.15"), "upi_notify_usteps_termination");
    assert.equal(liveObligationKeyForRequirement("REQ-3.3.3"), "fba_bsp");
    assert.equal(liveObligationKeyForRequirement("REQ-4.4.6"), "fba_bsp");
    assert.equal(liveObligationKeyForRequirement("REQ-5.4.7"), "fba_bsp");
    assert.equal(liveObligationKeyForRequirement("REQ-3.4.3"), null);
    assert.equal(liveObligationKeyForRequirement("REQ-11.7.c"), "hhs_annual_outcome");
    assert.equal(liveObligationKeyForRequirement("REQ-8.6.c"), "dsi_annual_outcome");
    assert.equal(liveObligationKeyForRequirement("REQ-30.7.c"), "sei_annual_outcome");
    assert.equal(liveObligationKeyForRequirement("REQ-31.5.c"), "sl_annual_outcome");
    assert.equal(liveObligationKeyForRequirement("REQ-32.7.c"), "sl_annual_outcome");
    assert.equal(liveObligationKeyForRequirement("REQ-3.7.c"), "hhs_annual_outcome");
    assert.equal(liveObligationKeyForRequirement("REQ-18.6.c"), "hhs_annual_outcome");
    assert.equal(liveObligationKeyForRequirement("REQ-8.6"), "dsi_annual_outcome");
    assert.equal(liveObligationKeyForRequirement("REQ-11.7"), "hhs_annual_outcome");
    assert.equal(liveObligationKeyForRequirement("REQ-30.7"), "sei_annual_outcome");
    assert.ok(sowCatalogEntryByKey(EXPLICIT_REQ_TO_LIVE_KEY["REQ-11.7.c"] ?? ""));
    assert.ok(sowCatalogEntryByKey(EXPLICIT_REQ_TO_LIVE_KEY["REQ-3.7.c"] ?? ""));
    assert.equal(EXPLICIT_REQ_TO_LIVE_KEY["REQ-3.7.c"], "hhs_annual_outcome");
    assert.ok(sowCatalogEntryByKey(EXPLICIT_REQ_TO_LIVE_KEY["REQ-1.8.4"] ?? ""));
    assert.ok(sowCatalogEntryByKey(EXPLICIT_REQ_TO_LIVE_KEY["REQ-1.15.1"] ?? ""));
    assert.ok(sowCatalogEntryByKey(EXPLICIT_REQ_TO_LIVE_KEY["REQ-3.3.1"] ?? ""));
  });

  it("never mints a staff task for child elements", () => {
    const child = staffTaskPolicy({
      role: "element",
      parentKey: "REQ-1.8.4",
      createsUserTask: "yes",
      parentAssignment: "one",
    });
    assert.equal(child.mintsStaffTask, false);
    assert.equal(child.role, "element");
    const system = staffTaskPolicy({
      role: "parent",
      createsUserTask: "no",
      parentAssignment: "one",
    });
    assert.equal(system.mintsStaffTask, false);
  });

  it("drops element queue items when the parent is already present", () => {
    const filtered = filterDuplicateElementTasks([
      { requirementRole: "parent", parentRequirementKey: null, id: "p" },
      { requirementRole: "element", parentRequirementKey: "REQ-1.8.4", id: "e" },
    ]);
    assert.deepEqual(
      filtered.map((t) => t.id),
      ["p"],
    );
  });
});
