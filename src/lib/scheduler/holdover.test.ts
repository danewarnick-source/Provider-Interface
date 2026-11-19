import test from "node:test";
import assert from "node:assert/strict";
import { holdoverCandidates, holdoverRecord, type HoldShift } from "./holdover.ts";

const open = {
  id: "open",
  team_id: "maple",
  client_id: null,
  starts_at: "2026-11-19T22:00:00.000Z",
};
const ending = (id: string, staff: string, o: Partial<HoldShift> = {}): HoldShift => ({
  id,
  staff_id: staff,
  team_id: "maple",
  client_id: null,
  starts_at: "2026-11-19T14:00:00.000Z",
  ends_at: "2026-11-19T22:00:00.000Z",
  status: "published",
  published: true,
  shift_type: "day",
  ...o,
});
const now = new Date("2026-11-19T20:00:00.000Z");

test("only people whose shift ends when the open one starts, at the same home or client", () => {
  const shifts = [
    ending("a", "ben"),
    ending("b", "ava", { ends_at: "2026-11-19T21:30:00.000Z" }),
    ending("c", "kai", { team_id: "cedar" }),
    ending("d", "leo", { status: "cancelled" }),
    ending("e", "omar", { shift_type: "oncall" }),
    ending("f", "theo", { published: false }),
    ending("g", "chris", { team_id: null, client_id: "riley" }),
  ];
  assert.deepEqual(
    holdoverCandidates(open, shifts, [], now).map((c) => c.staffId),
    ["ben"],
  );
  assert.deepEqual(
    holdoverCandidates({ ...open, team_id: null, client_id: "riley" }, shifts, [], now).map(
      (c) => c.shiftId,
    ),
    ["g"],
  );
  assert.deepEqual(holdoverCandidates(open, shifts, [], now, new Set(["ben"])), []);
});

test("never held over first, then longest ago, then fewest this month", () => {
  const shifts = [
    ending("a", "ava"),
    ending("b", "ben"),
    ending("c", "grace"),
    ending("d", "theo"),
  ];
  const records = [
    { staffId: "ava", at: "2026-10-09T05:00:00.000Z", reason: null },
    { staffId: "ben", at: "2026-08-30T05:00:00.000Z", reason: null },
    { staffId: "theo", at: "2026-11-02T05:00:00.000Z", reason: null },
    { staffId: "theo", at: "2026-08-30T05:00:00.000Z", reason: null },
  ];
  assert.deepEqual(
    holdoverCandidates(open, shifts, records, now).map((c) => c.staffId),
    ["grace", "ben", "ava", "theo"],
  );
});

test("the record lists everyone, next up first, with their last hold-over and this month", () => {
  const people = [
    { id: "ava", name: "Ava Lee" },
    { id: "ben", name: "Ben Ortiz" },
    { id: "omar", name: "Omar Diaz" },
    { id: "theo", name: "Theo Park" },
  ];
  const records = [
    { staffId: "ava", at: "2026-11-03T05:00:00.000Z", reason: "Held over: no one else available" },
    { staffId: "ava", at: "2026-11-10T05:00:00.000Z", reason: "Stayed for Maple" },
    { staffId: "theo", at: "2026-11-03T05:00:00.000Z", reason: null },
    { staffId: "ben", at: "2026-10-31T05:00:00.000Z", reason: null },
  ];
  const rows = holdoverRecord(people, records, now);
  assert.deepEqual(
    rows.map((r) => r.staffId),
    ["omar", "ben", "theo", "ava"],
  );
  const ava = rows.find((r) => r.staffId === "ava")!;
  assert.equal(ava.month, 2);
  assert.equal(ava.last, "2026-11-10T05:00:00.000Z");
  assert.equal(ava.lastReason, "Stayed for Maple");
  // Oct 31 at 11p Denver is still October there.
  assert.equal(rows.find((r) => r.staffId === "ben")!.month, 0);
  assert.equal(rows.find((r) => r.staffId === "omar")!.last, null);
});

test("same last hold-over: fewer this month goes first", () => {
  const people = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const records = [
    { staffId: "a", at: "2026-11-05T05:00:00.000Z", reason: null },
    { staffId: "a", at: "2026-11-01T18:00:00.000Z", reason: null },
    { staffId: "b", at: "2026-11-05T05:00:00.000Z", reason: null },
  ];
  assert.deepEqual(
    holdoverRecord(people, records, now).map((r) => r.staffId),
    ["b", "a"],
  );
});
