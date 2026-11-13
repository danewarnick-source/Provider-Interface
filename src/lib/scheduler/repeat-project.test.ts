import test from "node:test";
import assert from "node:assert/strict";
import { projectShifts, type ShiftRow } from "./repeat-project.ts";
import { dayKey, weekdayOf } from "./time.ts";

function shift(id: string, startsAt: string, endsAt: string): ShiftRow {
  return {
    id, staff_id: "s1", client_id: "c1", service_code: "SLH",
    starts_at: startsAt, ends_at: endsAt, shift_type: "hourly", is_awake_overnight: null, notes: null,
  };
}

// Sunday 2026-10-11 .. Saturday 2026-10-17 (Denver, MDT = UTC-6)
const SRC_WEEK = [
  shift("sun", "2026-10-11T15:00:00Z", "2026-10-11T19:00:00Z"),
  shift("mon", "2026-10-12T15:00:00Z", "2026-10-12T19:00:00Z"),
  shift("sat", "2026-10-17T15:00:00Z", "2026-10-17T19:00:00Z"),
];

test("a copied week lands on the same weekdays (Sunday-based)", () => {
  const out = projectShifts(SRC_WEEK, "2026-10-18T06:00:00Z"); // Sunday Oct 18 00:00 MDT
  assert.deepEqual(out.map((p) => p.target_day), ["2026-10-18", "2026-10-19", "2026-10-24"]);
  for (const p of out) assert.equal(weekdayOf(dayKey(p.target_starts_at)), weekdayOf(dayKey(p.starts_at)));
});

test("a shift late in the Denver evening keeps its weekday (UTC date differs)", () => {
  // Saturday 21:00 MDT = Sunday 03:00Z
  const late = shift("late", "2026-10-18T03:00:00Z", "2026-10-18T05:00:00Z");
  const [p] = projectShifts([late], "2026-10-25T06:00:00Z");
  assert.equal(p.target_day, "2026-10-31"); // Saturday of the target week
  assert.equal(dayKey(p.target_starts_at), "2026-10-31");
});

test("wall-clock time is kept across the DST change and duration is preserved", () => {
  // Source week of Oct 25 (MDT), target week of Nov 1 (fall back happens Nov 1 at 2am)
  const src = shift("a", "2026-10-28T15:00:00Z", "2026-10-28T19:00:00Z"); // Wed 09:00-13:00 MDT
  const [p] = projectShifts([src], "2026-11-01T07:00:00Z"); // Sunday Nov 1 00:00 MDT
  assert.equal(p.target_day, "2026-11-04");
  assert.equal(p.target_starts_at, "2026-11-04T16:00:00.000Z"); // 09:00 MST
  assert.equal(new Date(p.target_ends_at).getTime() - new Date(p.target_starts_at).getTime(), 4 * 3600_000);
});

test("a month source does not collapse repeated weekdays into extra rows", () => {
  const two = [
    shift("w1", "2026-10-06T15:00:00Z", "2026-10-06T19:00:00Z"),
    shift("w2", "2026-10-13T15:00:00Z", "2026-10-13T19:00:00Z"),
  ];
  assert.equal(projectShifts(two, "2026-10-18T06:00:00Z").length, 1);
});
