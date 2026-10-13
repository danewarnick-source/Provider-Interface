import test from "node:test";
import assert from "node:assert/strict";
import { ctx, has, shift } from "./rules-fixtures.ts";
import { evaluateShift, evaluateShifts, hasBlock, blocksOf, warningsOf, minStaffAgeForCode } from "./rules.ts";

const run = (s = shift(), c = ctx()) => evaluateShift(s, c);

test("minimum age: 16 base, 18 to drive or for DCFS/DJJYS, 21 for HHS/PPS, agency can raise to 18", () => {
  assert.equal(minStaffAgeForCode("SLH"), 16);
  assert.equal(minStaffAgeForCode("SLH", { driving: true }), 18);
  assert.equal(minStaffAgeForCode("SLH", { custody: "dcfs" }), 18);
  assert.equal(minStaffAgeForCode("SLH", { custody: "djjys" }), 18);
  assert.equal(minStaffAgeForCode("SLH", { agencyFloor18: true }), 18);
  assert.equal(minStaffAgeForCode("HHS"), 21);
  assert.equal(minStaffAgeForCode("pps"), 21);
  assert.ok(has(run(shift(), ctx({ staff: { age: 15 } })), "under_minimum_age", "block"));
  assert.ok(!has(run(shift(), ctx({ staff: { age: 16 } })), "under_minimum_age"));
  assert.ok(has(run(shift({ driving: true }), ctx({ staff: { age: 17 } })), "under_minimum_age"));
  assert.ok(has(run(shift(), ctx({ staff: { age: 17 }, client: { custody: "djjys" } })), "under_minimum_age"));
  assert.ok(has(run(shift({ code: "HHS" }), ctx({ codes: ["HHS"], staff: { age: 20 } })), "under_minimum_age"));
  assert.ok(!has(run(shift({ code: "HHS" }), ctx({ codes: ["HHS"], staff: { age: 21 } })), "under_minimum_age"));
  assert.ok(has(run(shift(), ctx({ staff: { age: 17 }, settings: { minAge18: true } })), "under_minimum_age"));
});

test("evaluateShifts tags findings and hasBlock sees blocks; cancelled shifts are skipped", () => {
  const f = evaluateShifts([shift({ code: "COM" })], ctx());
  assert.equal(f[0]?.shiftId, "sh1");
  assert.ok(hasBlock(f));
  assert.deepEqual(evaluateShift(shift({ code: "COM", status: "cancelled" }), ctx()), []);
  assert.ok(!hasBlock(evaluateShifts([shift()], ctx())));
});

test("blocksOf and warningsOf split the findings", () => {
  const f = evaluateShifts([shift({ code: "COM" })], ctx());
  assert.ok(blocksOf(f).length >= 1 && blocksOf(f).every((x) => x.level === "block"));
  assert.ok(warningsOf(f).every((x) => x.level === "warn"));
});
