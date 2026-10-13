import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXEC_CAPABILITIES, capabilitiesForRole } from "./exec-capabilities.ts";

describe("exec capabilities (N2)", () => {
  it("no longer lists the retired extraction approval", () => {
    const caps: readonly string[] = EXEC_CAPABILITIES;
    assert.equal(caps.includes("extraction.approve"), false);
    assert.ok(caps.includes("billing.approve"));
    assert.equal(new Set(caps).size, caps.length);
  });

  it("gives the executive role every capability and no role none", () => {
    assert.deepEqual(capabilitiesForRole("executive"), [...EXEC_CAPABILITIES]);
    assert.deepEqual(capabilitiesForRole(null), []);
  });
});
