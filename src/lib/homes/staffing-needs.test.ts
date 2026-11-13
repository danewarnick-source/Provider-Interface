import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blockText,
  daysText,
  emptyBlock,
  groupNeeds,
  needDays,
  needProblems,
  timeText,
  type NeedRow,
} from "./staffing-needs.ts";

const row = (id: string, day: number | null, over: Partial<NeedRow> = {}): NeedRow => ({
  id,
  day_of_week: day,
  start_time: "15:00:00",
  end_time: "23:00:00",
  required_staff_count: 2,
  awake_required: false,
  notes: null,
  ...over,
});

test("one row per weekday with the same times is one Mon–Fri block", () => {
  const blocks = groupNeeds([1, 2, 3, 4, 5].map((d) => row(`r${d}`, d)));
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].days, [1, 2, 3, 4, 5]);
  assert.deepEqual(blocks[0].ids, ["r1", "r2", "r3", "r4", "r5"]);
  assert.equal(blockText(blocks[0]), "Mon–Fri · 3:00 PM – 11:00 PM · 2 staff");
});

test("a null day means every day", () => {
  const [b] = groupNeeds([row("all", null)]);
  assert.deepEqual(b.days, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(daysText(b.days), "Every day");
});

test("different times, counts or awake flags are separate blocks, earliest first", () => {
  const blocks = groupNeeds([
    row("eve", 1),
    row("night", 1, { start_time: "23:00:00", end_time: "07:00:00", awake_required: true }),
    row("morning", 1, { start_time: "07:00:00", end_time: "15:00:00", required_staff_count: 1 }),
  ]);
  assert.deepEqual(
    blocks.map((b) => b.ids[0]),
    ["morning", "eve", "night"],
  );
  assert.equal(
    blockText(blocks[2]),
    "Mon · 11:00 PM – 7:00 AM (next day) · 2 staff · awake overnight",
  );
});

test("seven days store as one every-day row; fewer store one row per day", () => {
  assert.deepEqual(needDays([0, 1, 2, 3, 4, 5, 6]), [null]);
  assert.deepEqual(needDays([5, 1, 1]), [1, 5]);
});

test("days read in week order with runs of three or more joined", () => {
  assert.equal(daysText([0, 6]), "Sat, Sun");
  assert.equal(daysText([1, 3, 5]), "Mon, Wed, Fri");
  assert.equal(daysText([5, 6, 0]), "Fri–Sun");
  assert.equal(daysText([1, 2, 4, 5, 6]), "Mon, Tue, Thu–Sat");
});

test("a block needs days, two different valid times and 1–20 staff", () => {
  assert.deepEqual(needProblems(emptyBlock()), [
    "Pick at least one day.",
    "Enter a start and end time.",
  ]);
  const ok = { ...emptyBlock(), days: [1], start: "15:00", end: "23:00", staff: 2 };
  assert.deepEqual(needProblems(ok), []);
  assert.deepEqual(needProblems({ ...ok, end: "15:00" }), [
    "The end time must differ from the start time.",
  ]);
  assert.deepEqual(needProblems({ ...ok, staff: 0 }), [
    "Staff needed is a whole number from 1 to 20.",
  ]);
  assert.deepEqual(needProblems({ ...ok, days: [7] }), ["Pick at least one day."]);
});

test("times read as 12-hour clock", () => {
  assert.equal(timeText("00:00"), "12:00 AM");
  assert.equal(timeText("12:30"), "12:30 PM");
  assert.equal(timeText("07:05"), "7:05 AM");
});
