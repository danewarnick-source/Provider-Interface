// Run with TZ=America/Denver (see package.json test:unit) and also valid under UTC.
import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysKey,
  dayKey,
  isInDayRange,
  parseLocalDate,
  shiftByDays,
  startOfWeek,
  toLocalRange,
  weekRange,
  weekStartKey,
  weekdayOf,
} from "./time.ts";

test("weekStartKey is Sunday", () => {
  assert.equal(weekdayOf("2026-10-11"), 0); // Sunday
  assert.equal(weekStartKey("2026-10-11"), "2026-10-11");
  assert.equal(weekStartKey("2026-10-12"), "2026-10-11"); // Monday
  assert.equal(weekStartKey("2026-10-17"), "2026-10-11"); // Saturday
  assert.equal(weekStartKey("2026-10-18"), "2026-10-18");
});

test("dayKey uses Denver, not UTC, around midnight", () => {
  // 2026-10-13 05:30Z is 23:30 MDT on Oct 12
  assert.equal(dayKey("2026-10-13T05:30:00Z"), "2026-10-12");
  // 06:00Z is exactly midnight MDT Oct 13
  assert.equal(dayKey("2026-10-13T06:00:00Z"), "2026-10-13");
  assert.equal(dayKey("2026-10-13T05:59:59Z"), "2026-10-12");
});

test("parseLocalDate gives Denver midnight (MDT and MST)", () => {
  assert.equal(parseLocalDate("2026-10-13").toISOString(), "2026-10-13T06:00:00.000Z");
  assert.equal(parseLocalDate("2026-12-01").toISOString(), "2026-12-01T07:00:00.000Z");
  assert.throws(() => parseLocalDate("nope"));
});

test("startOfWeek returns Sunday Denver midnight for any instant that day", () => {
  const expected = "2026-10-11T06:00:00.000Z";
  assert.equal(startOfWeek("2026-10-14T18:00:00Z").toISOString(), expected);
  // Sunday 23:30 Denver (Monday 05:30Z) is still the same week
  assert.equal(startOfWeek("2026-10-12T05:30:00Z").toISOString(), expected);
  // Monday 00:00 Denver is the same week, Saturday 23:59 too
  assert.equal(startOfWeek("2026-10-17T05:59:00Z").toISOString(), expected);
});

test("week spanning fall-back DST (Nov 1 2026) is 7 calendar days", () => {
  assert.equal(weekStartKey("2026-11-01"), "2026-11-01");
  const r = weekRange("2026-10-28T12:00:00Z");
  assert.equal(r.startIso, "2026-10-25T06:00:00.000Z");
  assert.equal(r.endExclusiveIso, "2026-11-01T06:00:00.000Z");
  const next = weekRange("2026-11-02T12:00:00Z");
  assert.equal(next.startIso, "2026-11-01T06:00:00.000Z"); // still MDT at midnight
  assert.equal(next.endExclusiveIso, "2026-11-08T07:00:00.000Z"); // MST after fall back
});

test("week spanning spring-forward DST (Mar 8 2026)", () => {
  const r = weekRange("2026-03-04T12:00:00Z");
  assert.equal(r.startIso, "2026-03-01T07:00:00.000Z");
  assert.equal(r.endExclusiveIso, "2026-03-08T07:00:00.000Z");
  const next = weekRange("2026-03-09T12:00:00Z");
  assert.equal(next.startIso, "2026-03-08T07:00:00.000Z");
  assert.equal(next.endExclusiveIso, "2026-03-15T06:00:00.000Z"); // MDT after spring forward
});

test("toLocalRange is inclusive of the end day", () => {
  const r = toLocalRange("2026-10-12", "2026-10-12");
  assert.equal(r.startIso, "2026-10-12T06:00:00.000Z");
  assert.equal(r.endExclusiveIso, "2026-10-13T06:00:00.000Z");
  assert.throws(() => toLocalRange("2026-10-12", "2026-10-11"));
});

test("addDaysKey crosses month and year", () => {
  assert.equal(addDaysKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysKey("2026-03-01", -1), "2026-02-28");
});

test("isInDayRange: late-evening Denver shift belongs to its Denver day", () => {
  // 03:00Z Oct 13 = 21:00 MDT Oct 12: inside a time-off ending Oct 12
  assert.equal(isInDayRange("2026-10-13T03:00:00Z", "2026-10-12", "2026-10-12"), true);
  assert.equal(isInDayRange("2026-10-13T07:00:00Z", "2026-10-12", "2026-10-12"), false);
});

test("shiftByDays keeps wall-clock across DST", () => {
  // 9:00 MDT Fri Oct 30 + 3 days = 9:00 MST Mon Nov 2 (16:00Z)
  assert.equal(shiftByDays("2026-10-30T15:00:00Z", 3), "2026-11-02T16:00:00.000Z");
  // same weekday one week later
  assert.equal(weekdayOf(dayKey(shiftByDays("2026-10-30T15:00:00Z", 7))), 5);
});
