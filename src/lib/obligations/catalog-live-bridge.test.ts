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
    assert.equal(liveObligationKeyForRequirement("REQ-1.28.5"), "pba_financial_review");
    assert.equal(liveObligationKeyForRequirement("REQ-15.3.7"), "pba_financial_review");
    assert.equal(liveObligationKeyForRequirement("REQ-1.11"), "zoning_life_safety");
    assert.equal(liveObligationKeyForRequirement("REQ-1.22.c"), "person_discharge_process");
    assert.equal(liveObligationKeyForRequirement("REQ-1.28.7"), "emergency_loan_record");
    assert.equal(liveObligationKeyForRequirement("REQ-1.28.7.G"), "large_loan_disclosure_process");
    assert.equal(liveObligationKeyForRequirement("REQ-1.28.9"), "no_gifts_process");
    assert.ok(sowCatalogEntryByKey(EXPLICIT_REQ_TO_LIVE_KEY["REQ-1.8.4"] ?? ""));
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
