// "No staff needed" blocks (B7): validation, the rows saved, and grouping
// stored rows back into blocks.
import test from "node:test";
import assert from "node:assert/strict";
import { noStaffBlocks, noStaffProblem, noStaffRows, noStaffWhen, type NoStaffDraft } from "./no-staff.ts";

const draft = (over: Partial<NoStaffDraft> = {}): NoStaffDraft => ({
  why: "At day program",
  explanation: "Everyone is at Lehi Day Program",
  start: "09:00",
  end: "15:00",
  often: "weekly",
  date: "2026-11-16",
  days: [1, 2, 3, 4, 5],
  ...over,
});

test("a block needs a reason, an explanation, times and its days or date", () => {
  assert.equal(noStaffProblem(draft()), null);
  assert.equal(noStaffProblem(draft({ why: "" })), "Pick why no staff is needed.");
  assert.equal(noStaffProblem(draft({ explanation: " ok " })), "Explain why no one needs to be there.");
  assert.equal(noStaffProblem(draft({ end: "" })), "Enter a start and end time.");
  assert.equal(noStaffProblem(draft({ days: [] })), "Pick at least one day.");
  assert.equal(noStaffProblem(draft({ often: "once", date: "" })), "Pick the date.");
  assert.equal(noStaffProblem(draft({ start: "07:00", end: "07:00" })), null);
});

test("weekly saves one 0-staff row per weekday (null for every day); once saves on_date", () => {
  const rows = noStaffRows(draft());
  assert.deepEqual(rows.map((r) => r.day_of_week), [1, 2, 3, 4, 5]);
  assert.ok(rows.every((r) => r.required_staff_count === 0 && r.on_date === null));
  assert.equal(rows[0]!.notes, "At day program: Everyone is at Lehi Day Program");
  assert.deepEqual(noStaffRows(draft({ days: [0, 1, 2, 3, 4, 5, 6] })).map((r) => r.day_of_week), [null]);
  const once = noStaffRows(draft({ often: "once" }));
  assert.deepEqual(once.map((r) => [r.day_of_week, r.on_date]), [[null, "2026-11-16"]]);
});

test("stored rows group back into blocks; real needs are left out", () => {
  const row = (id: string, day: number | null, on_date: string | null, staff = 0) => ({
    id, day_of_week: day, on_date, start_time: "09:00:00", end_time: "15:00:00",
    required_staff_count: staff, awake_required: false, notes: "At day program: van",
  });
  const blocks = noStaffBlocks([
    row("a", 1, null), row("b", 2, null), row("c", null, "2026-11-20"), row("d", 3, null, 2),
  ]);
  assert.deepEqual(blocks.map((b) => [b.ids, b.date, b.days]), [
    [["a", "b"], null, [1, 2]],
    [["c"], "2026-11-20", []],
  ]);
  assert.equal(noStaffWhen(blocks[0]!), "Mon, Tue · 9:00 AM – 3:00 PM");
  assert.equal(noStaffWhen({ days: [0, 1, 2, 3, 4, 5, 6], start: "07:00", end: "07:00" }), "Every day · all day");
});
