import test from "node:test";
import assert from "node:assert/strict";
import { fitLevel, isQualified, rankStaff, weekHours, type Candidate } from "./rank-staff.ts";
import type { Finding, RuleShift } from "./rules-types.ts";

const f = (rule: string, level: Finding["level"], message = rule, fix?: Finding["fix"]): Finding =>
  fix ? { rule, level, message, fix } : { rule, level, message };
const cand = (staffId: string, hoursThisWeek: number, findings: Finding[] = []): Candidate =>
  ({ staffId, name: staffId, hoursThisWeek, findings });

test("fitLevel: block beats reason beats reminder beats warn", () => {
  assert.equal(fitLevel([]), "ok");
  assert.equal(fitLevel([f("overtime", "warn")]), "warn");
  assert.equal(fitLevel([f("overtime", "warn"), f("cpr_first_aid", "warn")]), "reminder");
  assert.equal(fitLevel([f("cpr_first_aid", "warn"), f("on_time_off", "reason")]), "reason");
  assert.equal(fitLevel([f("on_time_off", "reason"), f("staff_double_booked", "block")]), "cant");
});

test("rankStaff orders by level, then fewest hours, then name", () => {
  const ranked = rankStaff([
    cand("cant", 0, [f("staff_double_booked", "block")]),
    cand("busy", 30),
    cand("reason", 1, [f("on_time_off", "reason")]),
    cand("free", 4),
    cand("warn", 0, [f("overtime", "warn")]),
    cand("card", 0, [f("cpr_first_aid", "warn")]),
  ]);
  assert.deepEqual(ranked.map((r) => r.staffId), ["free", "busy", "warn", "card", "reason", "cant"]);
  assert.deepEqual(ranked.map((r) => r.level), ["ok", "ok", "warn", "reminder", "reason", "cant"]);
});

test("reasons are the findings' text, worst first, without repeats", () => {
  const [r] = rankStaff([cand("a", 0, [f("overtime", "warn", "Over 40"), f("on_time_off", "reason", "Off Tue"),
    f("overtime", "warn", "Over 40")])]);
  assert.deepEqual(r!.reasons, ["Off Tue", "Over 40"]);
});

test("evidenceHref comes from a card finding's fix", () => {
  const href = "/dashboard/evidence?tab=staff&person=a&item=cpr";
  const [withCard] = rankStaff([cand("a", 0, [f("cpr_first_aid", "warn", "CPR expired", { label: "Open", href })])]);
  const [plain] = rankStaff([cand("b", 0, [f("overtime", "warn")])]);
  assert.equal(withCard!.evidenceHref, href);
  assert.equal(plain!.evidenceHref, null);
});

test("only ok and warn candidates are qualified for an offer", () => {
  assert.deepEqual(["ok", "warn", "reminder", "reason", "cant"].map((level) =>
    isQualified({ level: level as never })), [true, true, false, false, false]);
});

test("weekHours counts the Sun–Sat week, skips cancelled and the shift being placed", () => {
  const s = (id: string, startsAt: string, endsAt: string, status = "draft"): RuleShift =>
    ({ id, staffId: "a", clientId: "c", teamId: null, code: "DSI", startsAt, endsAt, status });
  const shifts = [
    s("1", "2026-11-09T15:00:00Z", "2026-11-09T19:00:00Z"), // Mon, 4 h
    s("2", "2026-11-10T15:00:00Z", "2026-11-10T17:30:00Z"), // Tue, 2.5 h
    s("3", "2026-11-11T15:00:00Z", "2026-11-11T23:00:00Z", "cancelled"),
    s("4", "2026-11-16T15:00:00Z", "2026-11-16T19:00:00Z"), // next week
  ];
  assert.equal(weekHours(shifts, "a", "2026-11-12"), 6.5);
  assert.equal(weekHours(shifts, "a", "2026-11-12", "1"), 2.5);
  assert.equal(weekHours(shifts, "b", "2026-11-12"), 0);
});
