import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DAILY_UNIT_CODES } from "./scheduler/billing-mode.ts";
import {
  DAILY_SERVICE_CODES, billingUnitLabel, hasDailyMode, isClockableServiceCode, isDailyServiceCode,
  isHourlyServiceCode, unitTypeLetter,
} from "./service-billing.ts";

describe("daily service codes come from billing-mode", () => {
  it("is exactly the rate table's daily-unit codes", () => {
    assert.deepEqual([...DAILY_SERVICE_CODES].sort(), [...DAILY_UNIT_CODES].sort());
  });

  it("PN1 is daily and RL6 is not (Decision 11)", () => {
    assert.equal(isDailyServiceCode("PN1"), true);
    assert.equal(isDailyServiceCode("RL6"), false);
    for (const c of ["HHS", "RHS", "PPS", "DSG", "RP4", "RP5", "SED", "MTP"]) assert.equal(isDailyServiceCode(c), true, c);
  });

  it("hourly codes stay hourly, including those with a daily mode", () => {
    for (const c of ["SLH", "SLN", "COM", "PAC", "RP2", "RP3", "EPR", "PN2", "DSI", "SEI"]) {
      assert.equal(isHourlyServiceCode(c), true, c);
    }
  });

  it("hasDailyMode sees the daily modes of COM, PAC, RP2, RP3, EPR, PN2", () => {
    for (const c of ["COM", "PAC", "RP2", "RP3", "EPR", "PN2", "PN1", "DSI", "SEE", "rp2"]) assert.equal(hasDailyMode(c), true, c);
    for (const c of ["SLH", "SEI", "BC1", null, undefined]) assert.equal(hasDailyMode(c), false, String(c));
  });

  it("labels and unit letters", () => {
    assert.equal(billingUnitLabel("PN1"), "Daily");
    assert.equal(billingUnitLabel("COM"), "Hourly");
    assert.equal(unitTypeLetter(null, "PN1"), "D");
    assert.equal(unitTypeLetter("day"), "D");
    assert.equal(unitTypeLetter("unit"), "Q");
  });

  it("HHS, PPS and MTP can't be clocked; RHS and DSG can", () => {
    assert.equal(isClockableServiceCode("HHS"), false);
    assert.equal(isClockableServiceCode("MTP"), false);
    assert.equal(isClockableServiceCode("RHS"), true);
    assert.equal(isClockableServiceCode("DSG"), true);
  });
});
