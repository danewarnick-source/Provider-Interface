import test from "node:test";
import assert from "node:assert/strict";
import { ctx, shift } from "./rules-fixtures.ts";
import { evaluateShift } from "./rules.ts";

test("baseline: a normal authorized SLH shift has no findings", () => {
  assert.deepEqual(evaluateShift(shift(), ctx()), []);
});
