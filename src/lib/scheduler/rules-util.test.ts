import test from "node:test";
import assert from "node:assert/strict";
import { at, ctx, shift } from "./rules-fixtures.ts";
import { agencyLevel, firstName, hoursOf, isLive, isSegmentPair, othersOf, overlaps } from "./rules-util.ts";

test("overlap treats back-to-back as not overlapping", () => {
  assert.equal(overlaps(shift({ startsAt: at(9), endsAt: at(11) }), shift({ id: "b", startsAt: at(10), endsAt: at(12) })), true);
  assert.equal(overlaps(shift({ startsAt: at(9), endsAt: at(11) }), shift({ id: "b", startsAt: at(11), endsAt: at(12) })), false);
});

test("hours, names, liveness and segment pairs", () => {
  assert.equal(hoursOf(shift()), 2);
  assert.equal(firstName("Maria Example"), "Maria");
  assert.equal(firstName(undefined), "This team member");
  assert.equal(isLive(shift({ status: "cancelled" })), false);
  assert.equal(isLive(shift({ status: "published" })), true);
  assert.equal(isSegmentPair(shift({ id: "a" }), shift({ id: "b", parentShiftId: "a" })), true);
  assert.equal(isSegmentPair(shift({ id: "a" }), shift({ id: "b" })), false);
});

test("othersOf drops the shift itself, cancelled shifts and duplicates", () => {
  const c = ctx({ shifts: [shift({ id: "a" }), shift({ id: "b" }), shift({ id: "c", status: "cancelled" })] });
  assert.deepEqual(othersOf(shift({ id: "a" }), c, [shift({ id: "b" }), shift({ id: "d" })]).map((s) => s.id), ["b", "d"]);
});

test("agencyLevel: default, off, and overridden", () => {
  assert.equal(agencyLevel(ctx(), "overtime", "warn"), "warn");
  assert.equal(agencyLevel(ctx({ settings: { rules: { overtime: { enabled: false, level: "warn" } } } }), "overtime", "warn"), null);
  assert.equal(agencyLevel(ctx({ settings: { rules: { overtime: { enabled: true, level: "block" } } } }), "overtime", "warn"), "block");
});
