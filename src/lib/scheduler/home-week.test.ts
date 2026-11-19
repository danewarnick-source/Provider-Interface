// Home page week panels and the resident facts they share with the rule
// engine (B7): Form 930 on a day, absence days used of the Worksheet number,
// RHS 1:1, Worksheet staffing hours and the 1:1 chips.
import test from "node:test";
import assert from "node:assert/strict";
import type { BoardShift } from "./board-model.ts";
import { oneToOneChips, worksheetHours } from "./home-week.ts";
import {
  absenceDaysLeft,
  absenceUse,
  form930On,
  isResidentOneToOne,
  type RhsCodeRow,
} from "./residential-facts.ts";

const HOME = "home-1";
const WEEK = ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"];
const code = (over: Partial<RhsCodeRow> = {}): RhsCodeRow => ({
  client_id: "r1",
  service_code: "RHS",
  service_start_date: "2026-07-01",
  service_end_date: "2027-07-01",
  worksheet_weekly_hours: 40,
  worksheet_absence_days: 12,
  ...over,
});
let seq = 0;
const shift = (day: string, a: number, b: number, over: Partial<BoardShift> = {}): BoardShift => ({
  id: `s${++seq}`,
  staff_id: "p1",
  client_id: null,
  team_id: HOME,
  service_code: "RHS",
  starts_at: new Date(`${day}T${String(a).padStart(2, "0")}:00:00-07:00`).toISOString(),
  ends_at: new Date(`${day}T${String(b).padStart(2, "0")}:00:00-07:00`).toISOString(),
  status: "published",
  published: true,
  parent_shift_id: null,
  open_spots: null,
  override_reason: null,
  shift_type: "day",
  notes: null,
  claim_requested_by: null,
  ...over,
});

test("Form 930: the one in effect that day, open-ended or longest", () => {
  const docs = [
    { client_id: "r1", effective_from: "2026-01-01", effective_to: "2026-12-31" },
    { client_id: "r1", effective_from: "2026-11-01", effective_to: "2027-03-31" },
    { client_id: "r2", effective_from: null, effective_to: null },
  ];
  assert.equal(form930On(docs, "r1", "2026-11-17")?.effective_to, "2027-03-31");
  assert.equal(form930On(docs, "r1", "2026-10-01")?.effective_to, "2026-12-31");
  assert.equal(form930On(docs, "r1", "2027-04-01"), null);
  assert.equal(form930On(docs, "r2", "2030-01-01")?.client_id, "r2");
  assert.equal(form930On(docs, "r3", "2026-11-17"), null);
});

test("absence days: counted inside the plan year, an open absence through today", () => {
  const absences = [
    { client_id: "r1", from_date: "2026-06-28", to_date: "2026-07-02" }, // 2 days in the year
    { client_id: "r1", from_date: "2026-09-10", to_date: "2026-09-10" }, // 1
    { client_id: "r1", from_date: "2026-11-18", to_date: null }, // 2 through the 19th
    { client_id: "r2", from_date: "2026-09-01", to_date: "2026-09-30" },
  ];
  assert.deepEqual(absenceUse(absences, [code()], "r1", "2026-11-19"), { used: 5, allowed: 12 });
  assert.equal(absenceDaysLeft(absences, [code()], "r1", "2026-11-19"), 7);
  assert.equal(absenceDaysLeft(absences, [code({ worksheet_absence_days: null })], "r1", "2026-11-19"), undefined);
  assert.deepEqual(absenceUse(absences, [], "r1", "2026-11-19"), { used: 0, allowed: null });
  assert.equal(absenceDaysLeft([], [code({ worksheet_absence_days: 3 })], "r1", "2026-11-19"), 3);
});

test("RHS 1:1 = an RHS shift at a home naming its resident", () => {
  assert.ok(isResidentOneToOne({ code: "rhs", teamId: HOME, clientId: "r1" }, HOME));
  assert.ok(!isResidentOneToOne({ code: "RHS", teamId: HOME, clientId: null }, HOME));
  assert.ok(!isResidentOneToOne({ code: "RHS", teamId: HOME, clientId: "r1" }, "elsewhere"));
  assert.ok(!isResidentOneToOne({ code: "DSI", teamId: HOME, clientId: "r1" }, HOME));
});

test("Worksheet hours: residents' weekly hours vs staffed vs open (with open spots)", () => {
  const shifts = [
    shift("2026-11-16", 7, 15),
    shift("2026-11-16", 15, 23, { staff_id: null, open_spots: 2 }),
    shift("2026-11-17", 7, 15, { status: "cancelled" }),
    shift("2026-11-17", 9, 13, { client_id: "r1" }),
    shift("2026-11-17", 10, 11, { parent_shift_id: "x" }),
    shift("2026-11-23", 7, 15),
  ];
  const w = worksheetHours(HOME, ["r1", "r2"], [code(), code({ client_id: "r2", worksheet_weekly_hours: 20 })], shifts, WEEK);
  assert.deepEqual(w, { worksheet: 60, staffed: 12, open: 16, short: 48 });
  assert.equal(worksheetHours(HOME, ["r1"], [], shifts, WEEK).worksheet, null);
});

test("1:1 chips: resident RHS shifts at the home with their Form 930", () => {
  const one = shift("2026-11-21", 16, 20, { client_id: "r1", staff_id: null });
  const chips = oneToOneChips(
    HOME,
    ["r1"],
    [{ client_id: "r1", effective_from: "2026-11-01", effective_to: "2026-11-20" }],
    [shift("2026-11-16", 7, 15), one, shift("2026-11-17", 9, 13, { client_id: "r1" })],
    WEEK,
  );
  assert.deepEqual(chips.map((c) => [c.day, !!c.form930]), [["2026-11-17", true], ["2026-11-21", false]]);
  assert.equal(chips[1]!.shift.id, one.id);
});
