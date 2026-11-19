// homeCoverage (B7): needed vs scheduled at a home, gaps, no staff needed and
// residents away. Monday Nov 16, 2026 (MST, UTC-7).
import test from "node:test";
import assert from "node:assert/strict";
import {
  barInstant,
  homeCoverage,
  minuteSpan,
  onCalendar,
  openShiftFor,
  type CoverageInput,
  type CoverageNeed,
  type CoverageShift,
} from "./coverage.ts";

const HOME = "home-1";
const MON = "2026-11-16";
const need = (over: Partial<CoverageNeed> = {}): CoverageNeed => ({
  id: "n1",
  team_id: HOME,
  day_of_week: null,
  on_date: null,
  start_time: "15:00:00",
  end_time: "23:00:00",
  required_staff_count: 2,
  notes: null,
  ...over,
});
let seq = 0;
/** Local MST times on a day → shift. */
const shift = (
  day: string,
  a: string,
  b: string,
  over: Partial<CoverageShift> = {},
): CoverageShift => {
  const iso = (d: string, t: string) => new Date(`${d}T${t}:00-07:00`).toISOString();
  const next = (d: string) =>
    new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return {
    id: `s${++seq}`,
    staff_id: `p${seq}`,
    client_id: null,
    team_id: HOME,
    starts_at: iso(day, a),
    ends_at: iso(b <= a ? next(day) : day, b),
    status: "published",
    parent_shift_id: null,
    shift_type: "evening",
    ...over,
  };
};
const run = (over: Partial<CoverageInput> = {}) =>
  homeCoverage({
    teamId: HOME,
    needs: [need()],
    away: [],
    residents: ["r1", "r2"],
    shifts: [],
    notCounted: new Set(),
    days: [MON],
    ...over,
  })[0]!;
const gapText = (d: ReturnType<typeof run>) =>
  d.gaps.map((g) => `${minuteSpan(g.from, g.to)}×${g.short}`);

test("a need with nobody scheduled is one gap, short by the head count", () => {
  const d = run();
  assert.deepEqual(gapText(d), ["3p–11p×2"]);
  assert.equal(d.neededHours, 8);
  assert.equal(d.shortHours, 8);
});

test("one of two staff leaves it short by one; two cover it", () => {
  assert.deepEqual(gapText(run({ shifts: [shift(MON, "15:00", "23:00")] })), ["3p–11p×1"]);
  const both = run({ shifts: [shift(MON, "15:00", "23:00"), shift(MON, "15:00", "23:00")] });
  assert.deepEqual(both.gaps, []);
  assert.ok(both.slots.filter((s) => s.needed).every((s) => s.state === "covered"));
});

test("the same person twice counts once", () => {
  const a = shift(MON, "15:00", "19:00");
  const b = shift(MON, "19:00", "23:00", { staff_id: a.staff_id });
  const c = shift(MON, "15:00", "23:00");
  assert.deepEqual(gapText(run({ shifts: [a, b, c] })), []);
  assert.deepEqual(gapText(run({ shifts: [a, { ...b, staff_id: a.staff_id }] })), ["3p–11p×1"]);
});

test("open, cancelled, on-call, 1:1 and not-counted types don't count", () => {
  const shifts = [
    shift(MON, "15:00", "23:00", { staff_id: null }),
    shift(MON, "15:00", "23:00", { status: "cancelled" }),
    shift(MON, "15:00", "23:00", { shift_type: "oncall" }),
    shift(MON, "15:00", "23:00", { client_id: "r1" }),
    shift(MON, "15:00", "23:00", { shift_type: "paired" }),
    shift(MON, "15:00", "23:00", { team_id: "other" }),
  ];
  assert.deepEqual(gapText(run({ shifts, notCounted: new Set(["paired"]) })), ["3p–11p×2"]);
});

test("staff inside a 1:1 segment don't count for that time", () => {
  const a = shift(MON, "15:00", "23:00");
  const b = shift(MON, "15:00", "23:00");
  const seg = shift(MON, "17:00", "18:00", {
    staff_id: a.staff_id,
    parent_shift_id: a.id,
    client_id: "r1",
  });
  assert.deepEqual(gapText(run({ shifts: [a, b, seg] })), ["5p–6p×1"]);
});

test("a 0-staff block (no staff needed) greys out its time, weekly or on one date", () => {
  const block = need({
    id: "z",
    start_time: "15:00",
    end_time: "17:00",
    required_staff_count: 0,
    notes: "At day program: van",
  });
  const d = run({ needs: [need(), block] });
  assert.deepEqual(gapText(d), ["5p–11p×2"]);
  assert.deepEqual(d.noStaff, [
    { id: "z", from: 900, to: 1020, reason: "At day program: van", weekly: true },
  ]);
  assert.ok(d.slots.find((s) => s.at === 900)!.off === "no_staff");
  const once = need({ ...block, on_date: "2026-11-17" });
  assert.deepEqual(gapText(run({ needs: [need(), once] })), ["3p–11p×2"]);
  assert.deepEqual(gapText(run({ needs: [need(), { ...once, on_date: MON }] })), ["5p–11p×2"]);
});

test("a one-date need applies only on that date; weekday needs only on their day", () => {
  assert.deepEqual(gapText(run({ needs: [need({ on_date: "2026-11-17" })] })), []);
  assert.deepEqual(gapText(run({ needs: [need({ on_date: MON })] })), ["3p–11p×2"]);
  assert.deepEqual(gapText(run({ needs: [need({ day_of_week: 2 })] })), []);
  assert.deepEqual(gapText(run({ needs: [need({ day_of_week: 1 })] })), ["3p–11p×2"]);
});

test("overlapping needs take the larger head count", () => {
  const d = run({
    needs: [
      need(),
      need({ id: "n2", start_time: "18:00", end_time: "20:00", required_staff_count: 3 }),
    ],
  });
  assert.deepEqual(gapText(d), ["3p–11p×3"]);
  assert.equal(d.slots.find((s) => s.at === 18 * 60)!.needed, 3);
});

test("an overnight need runs into the next morning on the same bar; the day before's spills in", () => {
  const night = need({ start_time: "23:00", end_time: "07:00", required_staff_count: 1 });
  const d = run({ needs: [night] });
  assert.deepEqual(gapText(d), ["11p–7a×1"]);
  const morning = need({ start_time: "22:00", end_time: "09:00", required_staff_count: 1 });
  assert.deepEqual(gapText(run({ needs: [morning] })), ["7a–9a×1", "10p–7a×1"]);
  const covered = run({ needs: [night], shifts: [shift(MON, "23:00", "07:00")] });
  assert.deepEqual(covered.gaps, []);
});

test("when every resident is away the hours need no staff; one at home keeps them needed", () => {
  const day = need({ start_time: "07:00", end_time: "23:00", required_staff_count: 1 });
  const weekdays = 0b0111110;
  const away = [
    { client_id: "r1", weekday_mask: weekdays, start_time: "09:00", end_time: "15:00" },
    { client_id: "r2", weekday_mask: weekdays, start_time: "08:30", end_time: "15:30" },
  ];
  const d = run({ needs: [day], away });
  assert.deepEqual(gapText(d), ["7a–9a×1", "3p–11p×1"]);
  assert.equal(d.slots.find((s) => s.at === 600)!.off, "away");
  assert.deepEqual(gapText(run({ needs: [day], away: away.slice(0, 1) })), ["7a–11p×1"]);
  const sunday = homeCoverage({
    teamId: HOME,
    needs: [day],
    away,
    residents: ["r1", "r2"],
    shifts: [],
    notCounted: new Set(),
    days: ["2026-11-15"],
  })[0]!;
  assert.deepEqual(gapText(sunday), ["7a–11p×1"]);
  assert.deepEqual(gapText(run({ needs: [day], away, residents: [] })), ["7a–11p×1"]);
});

test("the open shift overlapping a gap is found; calendar times and instants of a gap", () => {
  const open = shift(MON, "15:00", "23:00", { staff_id: null });
  const d = run({ shifts: [open] });
  assert.equal(openShiftFor(d.gaps[0]!, [open])?.id, open.id);
  assert.equal(openShiftFor({ ...d.gaps[0]!, from: 60, to: 120 }, [open]), null);
  assert.deepEqual(onCalendar(MON, 1500, 1560), {
    day: "2026-11-17",
    start: "01:00",
    end: "02:00",
  });
  assert.equal(barInstant(MON, 900), "2026-11-16T22:00:00.000Z");
});
