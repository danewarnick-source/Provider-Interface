import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EVV_SERVICE_CODES, evvServiceLabel, isEvvLockedCode, maskMemberId, padMemberId } from "./evv-codes.ts";

describe("maskMemberId", () => {
  it("shows only the last 4 characters", () => {
    assert.equal(maskMemberId("1234567890"), "****7890");
    assert.equal(maskMemberId("0001234567"), "****4567");
  });

  it("pads short ids before masking", () => {
    assert.equal(padMemberId("89"), "0000000089");
    assert.equal(maskMemberId("89"), "****0089");
  });

  it("returns empty for missing values", () => {
    assert.equal(maskMemberId(null), "");
    assert.equal(maskMemberId(""), "");
    assert.equal(maskMemberId("   "), "");
  });
});

describe("EVV code registry (DHHS91172 §1.12)", () => {
  it("EVV-mandated codes are exactly COM, HSQ, PAC, RP2, RP3, SLH, SLN, CMP, CMS", () => {
    const evv = EVV_SERVICE_CODES.filter((c) => c.evvLock).map((c) => c.code).sort();
    assert.deepEqual(evv, ["CMP", "CMS", "COM", "HSQ", "PAC", "RP2", "RP3", "SLH", "SLN"]);
    for (const c of evv) assert.equal(isEvvLockedCode(c), true, c);
  });

  it("ACA, CHA and LPS are not in the contract and are gone", () => {
    for (const c of ["ACA", "CHA", "LPS"]) {
      assert.equal(EVV_SERVICE_CODES.some((d) => d.code === c), false, c);
      assert.equal(isEvvLockedCode(c), false, c);
    }
  });

  it("non-EVV codes stay non-EVV", () => {
    for (const c of ["SEI", "RHS", "HHS", "DSI", "DSG", "PN1"]) assert.equal(isEvvLockedCode(c), false, c);
  });

  it("RP2 and RP3 labels follow the contract article titles", () => {
    assert.equal(evvServiceLabel("RP3"), "RP3 — Exceptional Care Respite Without Room and Board");
    assert.equal(evvServiceLabel("RP2"), "RP2 — Routine Respite Without Room and Board");
  });

  it("codes are unique", () => {
    const codes = EVV_SERVICE_CODES.map((c) => c.code);
    assert.equal(new Set(codes).size, codes.length);
  });
});
