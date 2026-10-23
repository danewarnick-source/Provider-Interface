import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { denverWallToIso } from "../denver-date.ts";
import { buildMarGrid, marMedications } from "./mar-grid.ts";
import {
  cellCode,
  isLateEntry,
  logKind,
  pausedWindows,
  summaryLine,
  type MarLog,
  type MarMed,
} from "./mar-cells.ts";
import {
  canSignOffMonth,
  initialsFor,
  monthDays,
  monthLabel,
  monthStart,
  parseMonth,
  shiftMonth,
  shortTime,
  staffInitials,
} from "./mar-month.ts";

const at = (day: string, h: number, m = 0) => denverWallToIso(day, h, m);
const addMin = (iso: string, min: number) => new Date(Date.parse(iso) + min * 60_000).toISOString();

const sert: MarMed = {
  id: "m1",
  medication_name: "Sertraline",
  scheduled_times: ["08:00", "20:00"],
  start_date: "2026-09-03",
  is_active: true,
};
const prn: MarMed = {
  id: "m2",
  medication_name: "Ibuprofen",
  is_prn: true,
  start_date: "2026-01-01",
  is_active: true,
};

function log(p: Partial<MarLog> & { id: string; scheduled_for: string }): MarLog {
  return { medication_id: "m1", status: "administered", staff_id: "s1", ...p };
}

describe("mar-month", () => {
  it("parses, shifts and labels months", () => {
    assert.deepEqual(parseMonth("2026-09"), { year: 2026, month: 9 });
    assert.equal(parseMonth("2026-13"), null);
    assert.equal(monthStart("2026-09"), "2026-09-01");
    assert.equal(monthDays("2026-02").length, 28);
    assert.equal(shiftMonth("2026-01", -1), "2025-12");
    assert.equal(monthLabel("2026-09"), "September 2026");
  });

  it("allows sign-off only after the month's last day", () => {
    assert.equal(canSignOffMonth("2026-09", new Date(at("2026-09-30", 23, 59))), false);
    assert.equal(canSignOffMonth("2026-09", new Date(at("2026-10-01", 0, 1))), true);
    assert.equal(canSignOffMonth("2026-10", new Date(at("2026-10-14", 12))), false);
  });

  it("formats initials and short times", () => {
    assert.equal(initialsFor("Tara Jo Jones"), "TJ");
    assert.equal(initialsFor("Cher"), "CH");
    const m = staffInitials([
      { id: "b", full_name: "Tom Jay" },
      { id: "a", full_name: "Tara Jones" },
    ]);
    assert.equal(m.get("a"), "TJ");
    assert.equal(m.get("b"), "TJ2");
    assert.equal(shortTime(at("2026-09-05", 8, 4)), "8:04a");
    assert.equal(shortTime(at("2026-09-05", 20, 15)), "8:15p");
  });
});

describe("mar-grid", () => {
  it("maps logged statuses to cell kinds", () => {
    assert.equal(logKind({ status: "administered" }), "given");
    assert.equal(logKind({ status: "self_administered" }), "given");
    assert.equal(logKind({ status: "refused" }), "refused");
    assert.equal(
      logKind({ status: "omitted", exception_reason: "Not home - with family" }),
      "away",
    );
    assert.equal(logKind({ status: "omitted", exception_reason: "Held by nurse" }), "held");
    assert.equal(logKind({ status: "loa" }), "away");
  });

  it("flags entries documented more than an hour after the dose", () => {
    const taken = at("2026-09-05", 8);
    assert.equal(
      isLateEntry(
        log({
          id: "x",
          scheduled_for: taken,
          actual_taken_at: taken,
          documented_at: addMin(taken, 61),
        }),
      ),
      true,
    );
    assert.equal(
      isLateEntry(
        log({
          id: "x",
          scheduled_for: taken,
          actual_taken_at: taken,
          documented_at: addMin(taken, 60),
        }),
      ),
      false,
    );
  });

  it("builds paused windows from the history", () => {
    const w = pausedWindows({ ...sert, paused_at: at("2026-09-20", 9) }, [
      { medication_id: "m1", action: "pause", changed_at: at("2026-09-10", 9) },
      { medication_id: "m1", action: "resume", changed_at: at("2026-09-12", 9) },
      { medication_id: "m1", action: "pause", changed_at: at("2026-09-20", 9) },
    ]);
    assert.equal(w.length, 2);
    assert.equal(w[1][1], Number.POSITIVE_INFINITY);
  });

  it("keeps meds active at any point in the month", () => {
    const list = marMedications(
      [
        sert,
        {
          id: "old",
          medication_name: "Old",
          is_active: false,
          discontinued_at: at("2026-08-20", 9),
          start_date: "2026-01-01",
        },
        {
          id: "late",
          medication_name: "Late",
          is_active: false,
          discontinued_at: at("2026-09-02", 9),
          start_date: "2026-01-01",
        },
        { id: "future", medication_name: "Future", start_date: "2026-10-05", is_active: true },
      ],
      "2026-09",
    );
    assert.deepEqual(list.map((m) => m.id).sort(), ["late", "m1"]);
  });

  it("fills cells: given, refused, missed, held, not due, upcoming; counts PRNs", () => {
    const g = buildMarGrid({
      month: "2026-09",
      meds: [sert, prn],
      changes: [
        { medication_id: "m1", action: "pause", changed_at: at("2026-09-10", 0) },
        { medication_id: "m1", action: "resume", changed_at: at("2026-09-11", 0) },
      ],
      logs: [
        log({
          id: "l1",
          scheduled_for: at("2026-09-05", 8),
          actual_taken_at: at("2026-09-05", 8, 4),
          documented_at: at("2026-09-05", 8, 5),
        }),
        log({
          id: "l2",
          scheduled_for: at("2026-09-05", 20),
          status: "refused",
          exception_reason: "Said no",
        }),
        log({
          id: "l3",
          scheduled_for: at("2026-09-06", 8),
          actual_taken_at: at("2026-09-06", 8),
          documented_at: at("2026-09-06", 11),
          is_medication_error: true,
        }),
        log({
          id: "p1",
          medication_id: "m2",
          scheduled_for: at("2026-09-07", 14),
          actual_taken_at: at("2026-09-07", 14),
          prn_followup_due_at: at("2026-09-07", 15),
        }),
        log({
          id: "p2",
          medication_id: "m2",
          scheduled_for: at("2026-09-07", 19),
          actual_taken_at: at("2026-09-07", 19),
          prn_followup_due_at: at("2026-09-07", 20),
          prn_followup_at: at("2026-09-07", 20),
        }),
      ],
      initials: new Map([["s1", "TJ"]]),
      now: new Date(at("2026-09-20", 12)),
    });
    const am = g.rows.find((r) => r.key === "m1:08:00");
    const pm = g.rows.find((r) => r.key === "m1:20:00");
    assert.ok(am && pm);
    const cell = (r: typeof am, day: string) => r.cells.find((c) => c.day === day);
    assert.equal(cell(am, "2026-09-02")?.kind, "not_due");
    assert.equal(cellCode(cell(am, "2026-09-05")!), "TJ 8:04a");
    assert.equal(cell(pm, "2026-09-05")?.kind, "refused");
    assert.equal(cell(am, "2026-09-06")?.late, true);
    assert.equal(cell(am, "2026-09-10")?.kind, "held");
    assert.equal(cell(am, "2026-09-11")?.kind, "missed");
    assert.equal(cell(am, "2026-09-25")?.kind, "upcoming");
    const prnRow = g.rows.find((r) => r.key === "m2:prn");
    assert.equal(prnRow?.prnCounts[6], 2);
    assert.equal(g.summary.given, 2);
    assert.equal(g.summary.refused, 1);
    assert.equal(g.summary.held, 2);
    assert.equal(g.summary.prnGiven, 2);
    assert.equal(g.summary.prnFollowupsMissing, 1);
    assert.equal(g.summary.errors, 1);
    assert.equal(g.summary.lateEntries, 1);
    // Sep 3..19 is 17 days x 2 times, plus Sep 20 8 AM = 35; minus 2 held = 33 due so far.
    assert.equal(g.summary.due, 33);
    assert.equal(g.summary.missed, 33 - 3);
    assert.match(summaryLine(g.summary), /^2 of 33 doses given · 1 refused · 30 missed · 2 held/);
  });

  it("keeps doses logged at a time that is no longer on the medication", () => {
    const g = buildMarGrid({
      month: "2026-09",
      meds: [sert],
      changes: [],
      logs: [
        log({ id: "l9", scheduled_for: at("2026-09-04", 9), actual_taken_at: at("2026-09-04", 9) }),
      ],
      initials: new Map(),
      now: new Date(at("2026-09-01", 1)),
    });
    const row = g.rows.find((r) => r.time === "09:00");
    assert.equal(row?.oldTime, true);
    assert.equal(row?.cells.find((c) => c.day === "2026-09-04")?.kind, "given");
  });
});
