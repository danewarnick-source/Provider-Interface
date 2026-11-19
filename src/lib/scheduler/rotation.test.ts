import test from "node:test";
import assert from "node:assert/strict";
import {
  maskOf,
  parseCycle,
  patternKind,
  patternLabel,
  rotationDays,
  rotationSlots,
  weekdaysLabel,
  type RotationLine,
} from "./rotation.ts";
import { addDaysKey, weekdayOf } from "./time.ts";

const line = (o: Partial<RotationLine> = {}): RotationLine => ({
  id: "l1",
  staff_id: "maria",
  client_id: null,
  team_id: "maple",
  service_code: "RHS",
  shift_type: "day",
  cycle: [5, 2],
  cycle_start: "2026-11-01", // a Sunday
  weekday_mask: 0,
  start_time_local: "07:00:00",
  end_time_local: "15:00:00",
  effective_from: "2026-11-01",
  effective_until: null,
  active: true,
  ...o,
});
const wd = (days: string[]) => days.map((d) => weekdayOf(d));

test("5 on / 2 off works Sun–Thu from a Sunday start, every week", () => {
  const days = rotationDays(line(), "2026-11-01", "2026-11-14");
  assert.deepEqual(wd(days), [0, 1, 2, 3, 4, 0, 1, 2, 3, 4]);
});

test("2-2-3 repeats every 14 days: on 2, off 2, on 3, off 2, on 2, off 3", () => {
  const l = line({ cycle: [2, 2, 3, 2, 2, 3] });
  const days = rotationDays(l, "2026-11-01", "2026-12-26"); // 8 weeks
  const offsets = days.map((d) => (Date.parse(d) - Date.parse("2026-11-01")) / 86_400_000);
  const first = [0, 1, 4, 5, 6, 9, 10];
  assert.deepEqual(
    offsets,
    [0, 1, 2, 3].flatMap((k) => first.map((o) => o + 14 * k)),
  );
  assert.equal(days.length, 28); // 7 shifts per 14 days, 8 weeks
});

test("4 on / 4 off and 4 on / 3 off", () => {
  const four = rotationDays(line({ cycle: [4, 4] }), "2026-11-01", "2026-11-16");
  assert.deepEqual(four, [
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
  ]);
  const fourThree = rotationDays(line({ cycle: [4, 3] }), "2026-11-01", "2026-11-14");
  assert.deepEqual(wd(fourThree), [0, 1, 2, 3, 0, 1, 2, 3]);
});

test("set weekdays: Mon and Wed only", () => {
  const l = line({ cycle: null, cycle_start: null, weekday_mask: maskOf([1, 3]) });
  const days = rotationDays(l, "2026-11-01", "2026-11-28");
  assert.equal(days.length, 8);
  assert.ok(wd(days).every((d) => d === 1 || d === 3));
  assert.equal(patternLabel(l), "Mon, Wed");
});

test("every other weekend from a Saturday", () => {
  const l = line({ cycle: [2, 12], cycle_start: "2026-11-07", effective_from: "2026-11-07" });
  assert.equal(patternKind(l), "alt-weekend");
  assert.deepEqual(rotationDays(l, "2026-11-01", "2026-12-06"), [
    "2026-11-07",
    "2026-11-08",
    "2026-11-21",
    "2026-11-22",
    "2026-12-05",
    "2026-12-06",
  ]);
  // Started on a Sunday it's just a custom 2-on/12-off cycle.
  assert.equal(patternKind({ cycle: [2, 12], cycle_start: "2026-11-08" }), "custom");
});

test("custom cycle 6 on / 1 off; labels and parsing", () => {
  const l = line({ cycle: parseCycle("6-1") });
  assert.equal(rotationDays(l, "2026-11-01", "2026-11-14").length, 12);
  assert.equal(patternKind(l), "custom");
  assert.equal(patternLabel(l), "6 on / 1 off");
  assert.equal(patternLabel(line({ cycle: [3, 2, 2, 3] })), "3-2-2-3 cycle");
  assert.equal(patternLabel(line()), "5 on / 2 off");
  assert.equal(parseCycle("6"), null);
  assert.equal(parseCycle("0-2"), null);
  assert.deepEqual(parseCycle(" 3 / 2 "), [3, 2]);
  assert.equal(weekdaysLabel(maskOf([1, 2, 3, 4, 5])), "Mon–Fri");
  assert.equal(weekdaysLabel(127), "Every day");
});

test("a cycle counts from its start even when the window starts mid-cycle", () => {
  // Cycle started Oct 30 (Fri); Nov 1 is day 2 of the 5 on.
  const l = line({ cycle_start: "2026-10-30", effective_from: "2026-10-30" });
  assert.deepEqual(rotationDays(l, "2026-11-01", "2026-11-07"), [
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-06",
    "2026-11-07",
  ]);
});

test("nothing before the cycle start or effective_from, nothing after effective_until", () => {
  const l = line({
    cycle_start: "2026-11-08",
    effective_from: "2026-11-08",
    effective_until: "2026-11-10",
  });
  assert.deepEqual(rotationDays(l, "2026-11-01", "2026-11-30"), [
    "2026-11-08",
    "2026-11-09",
    "2026-11-10",
  ]);
  assert.deepEqual(rotationDays(line({ active: false }), "2026-11-01", "2026-11-30"), []);
});

test("wall-clock times hold across the DST change (Nov 1, 2026)", () => {
  const l = line({ cycle: [7, 0], cycle_start: "2026-10-31", effective_from: "2026-10-31" });
  const [sat, sun] = rotationSlots(l, "2026-10-31", "2026-11-01");
  assert.equal(sat!.starts_at, "2026-10-31T13:00:00.000Z"); // 7a MDT
  assert.equal(sun!.starts_at, "2026-11-01T14:00:00.000Z"); // 7a MST
  assert.equal(sun!.ends_at, "2026-11-01T22:00:00.000Z"); // 3p MST
});

test("an overnight slot ends the next morning and belongs to its start day", () => {
  const l = line({ start_time_local: "23:00", end_time_local: "07:00" });
  const slots = rotationSlots(l, "2026-11-02", "2026-11-02");
  assert.equal(slots.length, 1);
  assert.equal(slots[0]!.day, "2026-11-02");
  assert.equal(slots[0]!.starts_at, "2026-11-03T06:00:00.000Z"); // Mon 11p MST
  assert.equal(slots[0]!.ends_at, "2026-11-03T14:00:00.000Z"); // Tue 7a MST
  // Over the DST night (Sat Oct 31 → Sun Nov 1) the shift is 9 real hours.
  const dst = rotationSlots(
    line({
      cycle: [7, 0],
      cycle_start: "2026-10-31",
      effective_from: "2026-10-31",
      start_time_local: "23:00",
      end_time_local: "07:00",
    }),
    "2026-10-31",
    "2026-10-31",
  )[0]!;
  assert.equal((Date.parse(dst.ends_at) - Date.parse(dst.starts_at)) / 3_600_000, 9);
});

test("day math doesn't depend on the runtime's time zone", () => {
  const days = rotationDays(line(), "2026-11-01", addDaysKey("2026-11-01", 27));
  assert.equal(days.length, 20);
});
