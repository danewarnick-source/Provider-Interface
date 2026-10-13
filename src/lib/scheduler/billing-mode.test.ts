import test from "node:test";
import assert from "node:assert/strict";
import {
  BILLING_MODES, DAILY_MODE_CODES, DAILY_UNIT_CODES, billingFor, billingSpec, entryQuarterHours,
} from "./billing-mode.ts";

const D = "2026-10-14";

test("quarter hours round per entry, not on the sum", () => {
  assert.equal(entryQuarterHours(7), 0);
  assert.equal(entryQuarterHours(8), 1);
  // two 7-minute entries: 0 + 0, while a rounded sum (14 min) would give 1
  assert.equal(billingFor("SLH", [7, 7], D).units, 0);
  assert.equal(billingFor("SLH", [60, 8], D).units, 5);
});

test("COM: 6 h stays quarter hours, 6 h 15 m goes daily", () => {
  const six = billingFor("COM", 360, D);
  assert.equal(six.unitType, "quarter_hour");
  assert.equal(six.units, 24);
  const over = billingFor("COM", 375, D);
  assert.equal(over.unitType, "day");
  assert.equal(over.units, 1);
  assert.equal(billingFor("COM", [200, 175], D).unitType, "day");
});

test("PAC: daily only over 8 h", () => {
  assert.equal(billingFor("PAC", 480, D).unitType, "quarter_hour");
  assert.equal(billingFor("PAC", 495, D).unitType, "day");
});

test("RP2 and RP3: daily at 6 h or more, quarter hours below", () => {
  for (const c of ["RP2", "RP3"]) {
    assert.equal(billingFor(c, 345, D).unitType, "quarter_hour");
    assert.equal(billingFor(c, 360, D).unitType, "day");
  }
});

test("DSI and SEE bill 1 to 6 hour daily tiers", () => {
  for (const c of ["DSI", "SEE"]) {
    assert.equal(billingFor(c, 30, D).tier, 1);
    assert.equal(billingFor(c, 60, D).tier, 1);
    assert.equal(billingFor(c, 61, D).tier, 2);
    assert.equal(billingFor(c, 180, D).tier, 3);
    assert.equal(billingFor(c, 360, D).tier, 6);
    assert.equal(billingFor(c, 500, D).tier, 6);
    assert.equal(billingFor(c, 90, D).unitType, "tier");
  }
});

test("daily, session, monthly and milestone codes", () => {
  for (const c of ["RHS", "HHS", "PPS", "DSG", "RP4", "RP5", "SED", "PN1", "MTP"]) {
    assert.equal(billingFor(c, 45, D).unitType, "day", c);
  }
  assert.equal(billingFor("RPS", 120, D).unitType, "session");
  assert.equal(billingFor("PBA", 120, D).unitType, "month");
  assert.equal(billingFor("SJP", 0.5, D).unitType, "milestone");
});

test("authorization-chosen daily mode (DSP, EPR, PN2) only when asked", () => {
  for (const c of ["DSP", "EPR", "PN2"]) {
    assert.equal(billingFor(c, 120, D).unitType, "quarter_hour");
    assert.equal(billingFor(c, 120, D, { dailyRate: true }).unitType, "day");
  }
  assert.equal(billingFor("SLH", 120, D, { dailyRate: true }).unitType, "quarter_hour");
});

test("no time bills nothing; unknown code falls back to quarter hours", () => {
  assert.equal(billingFor("SLH", 0, D).units, 0);
  assert.equal(billingFor("RHS", 0, D).units, 0);
  assert.equal(billingFor("ZZZ", 30, D).units, 2);
});

test("every contract code has a spec, RL6/ACA/CHA/LPS do not", () => {
  const codes = ["BC1","BC2","BC3","COM","DSG","DSP","DSI","EPR","ELS","HHS","HSQ","MTP","PAC","PBA","PM1","PM2","PN1","PN2","PPS","RHS","RP2","RP3","RP4","RP5","RPS","SEC","SED","SEE","SEI","SLH","SLN","CMP","CMS","SJD","SJP","SJR","TFB"];
  for (const c of codes) assert.ok(billingSpec(c), c);
  for (const c of ["RL6", "ACA", "CHA", "LPS"]) assert.equal(billingSpec(c), null, c);
  assert.equal(Object.keys(BILLING_MODES).length, codes.length);
});

test("daily lists", () => {
  assert.deepEqual([...DAILY_UNIT_CODES].sort(), ["DSG","HHS","MTP","PN1","PPS","RHS","RP4","RP5","SED"]);
  for (const c of ["COM", "PAC", "RP2", "RP3", "EPR", "PN2", "DSI", "SEE"]) assert.ok(DAILY_MODE_CODES.includes(c), c);
  assert.ok(!DAILY_MODE_CODES.includes("SLH"));
});
