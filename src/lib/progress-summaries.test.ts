import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bucketCodes,
  summariesOwed,
  summaryCadenceForCode,
  summaryCadenceLabel,
} from "./progress-summaries.ts";

test("monthly cadence: SEI, SJD, CMP, CMS, PN1, PN2", () => {
  for (const code of ["SEI", "SJD", "CMP", "CMS", "PN1", "PN2"]) {
    assert.equal(summaryCadenceForCode(code), "monthly", code);
  }
});

test("quarterly cadence for HHS, RHS, DSI, SLH, SLN and the other codes that owe one", () => {
  for (const code of ["HHS", "RHS", "DSI", "SLH", "SLN", "COM", "CHA", "PPS", "DSG", "SED", "BC1"]) {
    assert.equal(summaryCadenceForCode(code), "quarterly", code);
  }
});

test("PBA owes a monthly financial statement", () => {
  assert.equal(summaryCadenceForCode("pba"), "financial");
});

test("respite, ELS, MTP and PM1/PM2 owe no summary", () => {
  for (const code of ["ELS", "MTP", "PM1", "PM2", "RP2", "RP3", "RP4", "RP5", "RL6"]) {
    assert.equal(summaryCadenceForCode(code), null, code);
  }
  assert.equal(summaryCadenceForCode("  "), null);
});

test("summariesOwed lists every code that owes one, once, with UPI for SEI/SJD", () => {
  assert.deepEqual(summariesOwed(["hhs", "SEI", "RP2", "HHS", "PBA", "COM"]), [
    { code: "HHS", cadence: "quarterly", upi: false },
    { code: "SEI", cadence: "monthly", upi: true },
    { code: "PBA", cadence: "financial", upi: false },
    { code: "COM", cadence: "quarterly", upi: false },
  ]);
});

test("bucketCodes follows the same cadence rules", () => {
  const b = bucketCodes(["COM", "CMS", "PBA", "RP3"]);
  assert.deepEqual([...b.quarterly], ["COM"]);
  assert.deepEqual([...b.monthlyNarrative], ["CMS"]);
  assert.deepEqual([...b.monthlyFinancial], ["PBA"]);
});

test("cadence label says where the summary goes", () => {
  assert.match(summaryCadenceLabel("monthly", ["SEI"]), /UPI/);
  assert.match(summaryCadenceLabel("quarterly", ["HHS"]), /15 days after quarter end/);
});
