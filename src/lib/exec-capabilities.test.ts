import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXEC_CAPABILITIES, capabilitiesForRole } from "./exec-capabilities.ts";

describe("exec capabilities (N2)", () => {
  it("lists exactly the capabilities exec screens check (extraction approval retired in N2)", () => {
    assert.deepEqual(
      [...EXEC_CAPABILITIES],
      [
        "companies.read",
        "companies.write",
        "billing.approve",
        "upgrades.manage",
        "features.manage",
        "states.edit",
        "roles.manage",
        "agreements.read",
        "agreements.manage",
        "health.read",
        "support.manage",
        "steve.use",
        "knowledge.manage",
        "training.manage",
      ],
    );
  });

  it("gives the executive role every capability and no role none", () => {
    assert.deepEqual(capabilitiesForRole("executive"), [...EXEC_CAPABILITIES]);
    assert.deepEqual(capabilitiesForRole(null), []);
  });
});
