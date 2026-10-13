import test from "node:test";
import assert from "node:assert/strict";
import { defaultRatio, formatRatio, parseRatio, sedRatio, staffNeeded, weightOf } from "./ratios.ts";

const r16 = { ratio: { staff: 1, clients: 6 } };
const r13 = { ratio: { staff: 1, clients: 3 } };
const r11 = { ratio: { staff: 1, clients: 1 } };

test("worked example: nine at 1:6, one at 1:3, one at 1:1 is 2.83 so 3 staff", () => {
  const group = [...Array(9).fill(r16), r13, r11];
  const sum = group.reduce((a, c) => a + weightOf(c.ratio), 0);
  assert.equal(sum.toFixed(2), "2.83");
  assert.equal(staffNeeded(group), 3);
});

test("exactly six at 1:6 needs 1 (no float round-up), seven needs 2", () => {
  assert.equal(staffNeeded(Array(6).fill(r16)), 1);
  assert.equal(staffNeeded(Array(7).fill(r16)), 2);
});

test("empty group needs 0; 2:1 weighs 2", () => {
  assert.equal(staffNeeded([]), 0);
  assert.equal(staffNeeded([{ ratio: { staff: 2, clients: 1 } }]), 2);
  assert.notEqual(staffNeeded([r11, r11]), 1);
});

test("parse and format", () => {
  assert.deepEqual(parseRatio("1:6"), { staff: 1, clients: 6 });
  assert.equal(parseRatio("1:0"), null);
  assert.equal(parseRatio("six"), null);
  assert.equal(formatRatio({ staff: 2, clients: 1 }), "2:1");
});

test("defaults are assumed; residential has none", () => {
  for (const c of ["DSG", "DSP", "EPR", "RPS"]) assert.deepEqual(defaultRatio(c), { staff: 1, clients: 6, assumed: true });
  assert.deepEqual(defaultRatio("RP2", { place: "facility" }), { staff: 1, clients: 6, assumed: true });
  assert.deepEqual(defaultRatio("RP3", { place: "staff_home" }), { staff: 1, clients: 3, assumed: true });
  for (const c of ["DSI", "SLH", "SLN", "COM", "PAC", "SEI"]) assert.equal(defaultRatio(c)?.clients, 1);
  for (const c of ["RHS", "HHS", "PPS"]) assert.equal(defaultRatio(c), null);
  assert.equal(defaultRatio("SED", { groupSize: 5 })?.clients, 5);
  assert.equal(sedRatio(1).clients, 2);
  assert.equal(sedRatio(12).clients, 8);
});
