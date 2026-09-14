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
    assert.equal(liveObligationKeyForRequirement("REQ-1.12"), "evv_visit_verification");
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
    assert.deepEqual(filtered.map((t) => t.id), ["p"]);
  });
});
