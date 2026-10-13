import test from "node:test";
import assert from "node:assert/strict";
import { isStaleOpenPunch, openPunchDateLabel } from "./open-punch.ts";

test("a punch from earlier today is current", () => {
  assert.equal(isStaleOpenPunch("2026-10-13T14:00:00Z", new Date("2026-10-13T20:00:00Z")), false);
});

test("an overnight punch started last evening is still current in the morning", () => {
  // 10pm MDT Oct 12 -> 7am MDT Oct 13 (9 hours)
  assert.equal(isStaleOpenPunch("2026-10-13T04:00:00Z", new Date("2026-10-13T13:00:00Z")), false);
});

test("a punch from a previous day that has run past a long shift is stale", () => {
  assert.equal(isStaleOpenPunch("2026-10-12T15:00:00Z", new Date("2026-10-13T15:00:00Z")), true);
});

test("an old punch is stale even on the same Denver day boundary check", () => {
  assert.equal(isStaleOpenPunch("2026-10-10T15:00:00Z", new Date("2026-10-13T06:30:00Z")), true);
});

test("date label uses Denver", () => {
  assert.match(openPunchDateLabel("2026-10-13T05:30:00Z"), /Oct 12/);
});
