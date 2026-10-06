// Run with TZ=America/Denver (see package.json) — the bug these helpers fix
// only shows west of UTC.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ageOn, daysUntil, formatDate, parseLocalDate, todayYmd } from "./dates.ts";

process.env.TZ = "America/Denver";

describe("parseLocalDate", () => {
  it("keeps the calendar day (no UTC shift)", () => {
    const d = parseLocalDate("2026-07-01")!;
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 6);
    assert.equal(d.getDate(), 1);
    assert.equal(d.getHours(), 0);
  });
  it("accepts an ISO timestamp's date part", () => {
    assert.equal(parseLocalDate("2026-01-05T00:00:00Z")!.getDate(), 5);
  });
  it("rejects blank and invalid", () => {
    assert.equal(parseLocalDate(null), null);
    assert.equal(parseLocalDate(""), null);
    assert.equal(parseLocalDate("not a date"), null);
    assert.equal(parseLocalDate("2026-02-30"), null);
  });
});

describe("formatDate", () => {
  it("formats the same day that was stored", () => {
    assert.equal(formatDate("2026-01-01"), "Jan 1, 2026");
  });
  it("uses the fallback", () => {
    assert.equal(formatDate(null), "—");
    assert.equal(formatDate("", undefined, "Not set"), "Not set");
  });
});

describe("ageOn", () => {
  it("counts the birthday itself", () => {
    assert.equal(ageOn("2000-07-01", new Date(2026, 6, 1)), 26);
  });
  it("day before the birthday", () => {
    assert.equal(ageOn("2000-07-01", new Date(2026, 5, 30)), 25);
  });
  it("null when blank", () => {
    assert.equal(ageOn(null), null);
  });
});

describe("daysUntil", () => {
  const today = new Date(2026, 6, 1, 18, 30);
  it("today is 0 even late in the evening", () => {
    assert.equal(daysUntil("2026-07-01", today), 0);
  });
  it("future and past", () => {
    assert.equal(daysUntil("2026-07-31", today), 30);
    assert.equal(daysUntil("2026-06-30", today), -1);
  });
  it("crosses DST without drift", () => {
    assert.equal(daysUntil("2026-11-02", new Date(2026, 10, 1)), 1);
  });
  it("null when blank", () => {
    assert.equal(daysUntil(undefined), null);
  });
});

describe("todayYmd", () => {
  it("uses the local calendar day, not UTC", () => {
    // 11pm in Utah on Jul 1 is already Jul 2 in UTC.
    assert.equal(todayYmd(new Date(2026, 6, 1, 23, 30)), "2026-07-01");
    assert.equal(todayYmd(new Date(2026, 0, 5)), "2026-01-05");
  });
});
