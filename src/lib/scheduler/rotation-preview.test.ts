import test from "node:test";
import assert from "node:assert/strict";
import { rotationPreview } from "./rotation-preview.ts";
import { rotationSlots, type RotationLine } from "./rotation.ts";

const line: RotationLine = {
  id: "l1",
  staff_id: "maria",
  client_id: null,
  team_id: "maple",
  service_code: "RHS",
  shift_type: "day",
  cycle: [5, 2],
  cycle_start: "2026-11-01",
  weekday_mask: 0,
  start_time_local: "07:00",
  end_time_local: "15:00",
  effective_from: "2026-11-01",
  effective_until: null,
  active: true,
};

test("groups the days into Sunday weeks with hours", () => {
  const weeks = rotationPreview(rotationSlots(line, "2026-11-04", "2026-12-01"), []);
  assert.deepEqual(
    weeks.map((w) => [w.label, w.days.length, w.hours]),
    [
      ["Nov 1–7", 2, 16],
      ["Nov 8–14", 5, 40],
      ["Nov 15–21", 5, 40],
      ["Nov 22–28", 5, 40],
      ["Nov 29 – Dec 5", 3, 24],
    ],
  );
  assert.ok(weeks.every((w) => w.flags.length === 0 && w.open === 0));
});

test("flags open, skipped and warned days; skipped days don't count hours", () => {
  const weeks = rotationPreview(rotationSlots(line, "2026-11-08", "2026-11-14"), [
    { day: "2026-11-08", as: "open", message: "Maria has approved time off" },
    { day: "2026-11-09", as: "skip", message: null },
    { day: "2026-11-10", as: "draft", message: "Over 40 h this week" },
    { day: "2026-11-11", as: "draft", message: null },
  ]);
  assert.equal(weeks.length, 1);
  const w = weeks[0]!;
  assert.equal(w.days.length, 4);
  assert.equal(w.hours, 32);
  assert.equal(w.open, 1);
  assert.deepEqual(w.flags, [
    { tone: "crit", text: "Nov 8 → open: Maria has approved time off" },
    { tone: "warn", text: "Nov 9 skipped: already booked" },
    { tone: "warn", text: "Nov 10: Over 40 h this week" },
  ]);
});
