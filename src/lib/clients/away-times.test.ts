// A client's away times (B7): validation, weekday masks and the line shown.
import test from "node:test";
import assert from "node:assert/strict";
import { awayMask, awayProblem, awayText, emptyAway, maskDays } from "./away-times.ts";

test("an away time needs days, a same-day time span and where", () => {
  const d = { ...emptyAway(), label: "job" as const };
  assert.equal(awayProblem(d), null);
  assert.equal(awayProblem({ ...d, label: "" }), "Pick where they are.");
  assert.equal(awayProblem({ ...d, days: [] }), "Pick at least one day.");
  assert.equal(
    awayProblem({ ...d, end: "08:00" }),
    "They have to be back after they leave, the same day.",
  );
  assert.equal(
    awayProblem({ ...d, start: "9:00" }),
    "Enter when they leave and when they're back.",
  );
});

test("weekday mask: Sunday is bit 0", () => {
  assert.equal(awayMask({ days: [1, 2, 3, 4, 5] }), 0b0111110);
  assert.deepEqual(maskDays(0b1000001), [0, 6]);
});

test("the line: days, time, where, details", () => {
  assert.equal(
    awayText({
      weekday_mask: 0b0111110,
      start_time: "08:30:00",
      end_time: "15:30:00",
      label: "job",
      note: "Costco",
    }),
    "Mon–Fri · 8:30 AM – 3:30 PM · Job · Costco",
  );
  assert.equal(
    awayText({
      weekday_mask: 0b10,
      start_time: "10:00",
      end_time: "14:00",
      label: "other_provider",
      note: null,
    }),
    "Mon · 10:00 AM – 2:00 PM · Another provider",
  );
});
