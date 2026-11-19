// Needs you coverage-gap rows (B7): past gaps drop off; an overlapping open
// shift is named with its offers; otherwise the row says nothing covers it.
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardShift } from "./board-model.ts";
import { gapRows } from "./needs-gaps.ts";

const gap = { teamId: "h1", day: "2026-11-16", from: 900, to: 1140, short: 2 };
const open: BoardShift = {
  id: "open-1",
  staff_id: null,
  client_id: null,
  team_id: "h1",
  service_code: "RHS",
  starts_at: "2026-11-16T22:00:00.000Z",
  ends_at: "2026-11-17T06:00:00.000Z",
  status: "open",
  published: true,
  parent_shift_id: null,
  open_spots: 1,
  override_reason: null,
  shift_type: "evening",
  notes: null,
  claim_requested_by: null,
};
const teams = new Map([["h1", { name: "Maple House" }]]);

test("a gap row: red, first tier, home · day · span, and why", () => {
  const [row] = gapRows([gap], [], teams, new Map(), new Date("2026-11-16T12:00:00Z"));
  assert.equal(row!.kind, "coverage_gap");
  assert.equal(row!.tier, 0);
  assert.equal(row!.title, "Maple House · Mon Nov 16 · No one 3p–7p");
  assert.equal(row!.why, "Short 2. No shift covers this time.");
  assert.equal(row!.shiftId, undefined);
  assert.equal(row!.at, "2026-11-16T22:00:00.000Z");
});

test("an overlapping open shift is the fix; a gap already over is left out", () => {
  const [row] = gapRows(
    [gap],
    [open],
    teams,
    new Map([["open-1", 3]]),
    new Date("2026-11-16T12:00:00Z"),
  );
  assert.equal(row!.shiftId, "open-1");
  assert.equal(row!.why, "An open shift covers it. Offered to 3.");
  assert.deepEqual(gapRows([gap], [open], teams, new Map(), new Date("2026-11-17T03:00:00Z")), []);
});
