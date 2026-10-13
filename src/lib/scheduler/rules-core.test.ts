import test from "node:test";
import assert from "node:assert/strict";
import { DAY, SUNDAY, at, auth, client, ctx, has, shift } from "./rules-fixtures.ts";
import { evaluateShift } from "./rules.ts";
import { addDaysKey } from "./time.ts";

const run = (s = shift(), c = ctx()) => evaluateShift(s, c);

test("no authorization that day blocks; an authorized code passes", () => {
  assert.ok(has(run(shift({ code: "COM" })), "no_authorization", "block"));
  assert.ok(!has(run(), "no_authorization"));
  const expired = ctx({ client: { authorizations: [auth("SLH", { endDate: "2026-10-13" })] } });
  assert.ok(has(run(shift(), expired), "no_authorization"));
});

test("units over the authorization block, exactly enough passes", () => {
  const low = (n: number) => ctx({ client: { authorizations: [auth("SLH", { unitsLeft: n })] } });
  assert.ok(has(run(shift(), low(7)), "over_authorized_units", "block")); // 2 h = 8 units
  assert.ok(!has(run(shift(), low(8)), "over_authorized_units"));
});

test("not on the client's team blocks", () => {
  assert.ok(has(run(shift(), ctx({ client: { teamStaffIds: ["s2"] } })), "not_on_team", "block"));
  assert.ok(!has(run(), "not_on_team"));
});

test("do-not-schedule list blocks", () => {
  assert.ok(has(run(shift(), ctx({ client: { doNotScheduleStaffIds: ["s1"] } })), "do_not_schedule", "block"));
  assert.ok(!has(run(), "do_not_schedule"));
});

test("inactive staff and approved time off block", () => {
  assert.ok(has(run(shift(), ctx({ staff: { active: false } })), "staff_inactive", "block"));
  assert.ok(has(run(shift(), ctx({ staff: { timeOff: [[DAY, DAY]] } })), "on_time_off", "block"));
  assert.ok(!has(run(shift(), ctx({ staff: { timeOff: [["2026-10-15", "2026-10-16"]] } })), "on_time_off"));
  assert.ok(!has(run(), "staff_inactive"));
});

test("same staff in two places blocks; back-to-back is fine", () => {
  const other = shift({ id: "o", clientId: null, teamId: "t2", code: "RHS", startsAt: at(10), endsAt: at(12) });
  assert.ok(has(run(shift(), ctx({ shifts: [other] })), "staff_double_booked", "block"));
  const b2b = shift({ id: "o", clientId: null, teamId: "t2", code: "RHS", startsAt: at(11), endsAt: at(13) });
  assert.ok(!has(run(shift(), ctx({ shifts: [b2b] })), "staff_double_booked"));
});

test("a segment inside its own parent shift is not a conflict", () => {
  const parent = shift({ id: "p", clientId: null, code: "RHS", startsAt: at(8), endsAt: at(17) });
  const seg = shift({ id: "g", code: "DSI", parentShiftId: "p", startsAt: at(9), endsAt: at(11) });
  const c = ctx({ codes: ["DSI"], shifts: [parent] });
  assert.ok(!has(run(seg, c), "staff_double_booked"));
  assert.ok(!has(run(seg, c), "segment_outside_parent"));
});

test("segment outside its parent blocks; a daily code on a segment blocks", () => {
  const parent = shift({ id: "p", clientId: null, code: "RHS", startsAt: at(8), endsAt: at(12) });
  const out = shift({ id: "g", code: "DSI", parentShiftId: "p", startsAt: at(11), endsAt: at(13) });
  const c = ctx({ codes: ["DSI", "DSG"], shifts: [parent] });
  assert.ok(has(run(out, c), "segment_outside_parent", "block"));
  assert.ok(has(run(shift({ id: "g2", code: "DSG", parentShiftId: "p", startsAt: at(9), endsAt: at(10) }), c), "daily_on_segment", "block"));
});

test("client double-booked or two services at once blocks", () => {
  const com = shift({ id: "o", staffId: "s2", code: "COM", startsAt: at(10), endsAt: at(12) });
  const c = ctx({ codes: ["COM"], shifts: [com] });
  assert.ok(has(run(shift(), c), "client_double_booked", "block"));
  const later = shift({ id: "o", staffId: "s2", code: "COM", startsAt: at(11), endsAt: at(12) });
  assert.ok(!has(run(shift(), ctx({ codes: ["COM"], shifts: [later] })), "client_double_booked"));
});

test("allowed overlaps do not count as two services at once", () => {
  for (const code of ["BC1", "BC2", "BC3", "HSQ", "PM1", "PM2", "PBA", "PN1", "PN2"]) {
    const o = shift({ id: "o", staffId: "s2", code, startsAt: at(10), endsAt: at(12) });
    assert.ok(!has(run(shift(), ctx({ codes: [code], shifts: [o] })), "client_double_booked"), code);
  }
});

test("daily RHS with an overlapping hourly DSI is allowed, RHS with SLH is not (Decision 5)", () => {
  const rhs = shift({ id: "o", staffId: "s2", code: "RHS", startsAt: at(8), endsAt: at(17) });
  const dsi = shift({ code: "DSI", startsAt: at(9), endsAt: at(11) });
  assert.ok(!has(run(dsi, ctx({ codes: ["DSI", "RHS"], shifts: [rhs] })), "client_double_booked"));
  assert.ok(has(run(shift(), ctx({ codes: ["RHS"], shifts: [rhs] })), "client_double_booked"));
});

test("2:1 without a rights modification blocks (§1.33(2))", () => {
  const second = shift({ id: "o", staffId: "s2", startsAt: at(9), endsAt: at(11) });
  assert.ok(has(run(shift(), ctx({ shifts: [second] })), "two_to_one_no_rights_mod", "block"));
  assert.ok(!has(run(shift(), ctx({ client: { hasRightsModification: true }, shifts: [second] })), "two_to_one_no_rights_mod"));
  assert.ok(!has(run(shift(), ctx({ shifts: [second] })), "client_double_booked"));
});

test("RHS 1:1 of 4+ hours with no Form 930 blocks (§21.3(4))", () => {
  const oneToOne = (h: number) => shift({ code: "RHS", staffingRatio: { staff: 1, clients: 1 }, startsAt: at(8), endsAt: at(8 + h) });
  const c = (f?: boolean) => ctx({ codes: ["RHS"], client: { hasForm930: f } });
  assert.ok(has(run(oneToOne(4), c()), "rhs_one_to_one_no_form_930", "block"));
  assert.ok(!has(run(oneToOne(3), c()), "rhs_one_to_one_no_form_930"));
  assert.ok(!has(run(oneToOne(4), c(true)), "rhs_one_to_one_no_form_930"));
});

test("SEI with SEE or SJD the same day blocks", () => {
  for (const code of ["SEE", "SJD"]) {
    const o = shift({ id: "o", staffId: "s2", code, startsAt: at(14), endsAt: at(15) });
    const sei = shift({ code: "SEI" });
    assert.ok(has(run(sei, ctx({ codes: ["SEI", code], shifts: [o] })), "sei_with_see_sjd", "block"), code);
  }
  assert.ok(!has(run(shift({ code: "SEI" }), ctx({ codes: ["SEI"] })), "sei_with_see_sjd"));
});

function groupCtx(extra: Parameters<typeof ctx>[0] = {}) {
  const base = ctx(extra);
  const ratio = (code: string, clients: number) => [{ code, staff: 1, clients, confirmed: true }];
  return {
    ...base,
    clients: {
      ...base.clients,
      c1: client({ ratios: ratio("DSG", 3) }),
      c2: client({ id: "c2", ratios: ratio("DSG", 1) }),
      ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`g${i}`, client({ id: `g${i}`, ratios: ratio("DSG", 6) })])),
    },
  };
}
const nine = Array.from({ length: 9 }, (_, i) => `g${i}`);
const dsg = (staffCount: number, ids = [...nine, "c1", "c2"]) =>
  shift({ clientId: null, code: "DSG", groupClientIds: ids, groupStaffCount: staffCount });

test("group needs staff from client ratios (9 at 1:6 + 1:3 + 1:1 is 3 staff)", () => {
  assert.ok(has(run(dsg(2), groupCtx()), "group_over_ratio", "block"));
  assert.ok(!has(run(dsg(3), groupCtx()), "group_over_ratio"));
});

test("group over licensed capacity blocks", () => {
  const places = { t1: { id: "t1", name: "Day Program", licensedCapacity: 10 } };
  assert.ok(has(run(dsg(3), groupCtx({ places })), "over_licensed_capacity", "block"));
  const big = { t1: { id: "t1", name: "Day Program", licensedCapacity: 11 } };
  assert.ok(!has(run(dsg(3), groupCtx({ places: big })), "over_licensed_capacity"));
});

test("CMP/CMS over 8 h a day or 40 h a week (Sun-Sat) blocks", () => {
  const long = shift({ code: "CMP", startsAt: at(7), endsAt: at(16) });
  assert.ok(has(run(long, ctx({ codes: ["CMP"] })), "cmp_cms_over_8h_day", "block"));
  const eight = shift({ code: "CMS", startsAt: at(7), endsAt: at(15) });
  assert.ok(!has(run(eight, ctx({ codes: ["CMS"] })), "cmp_cms_over_8h_day"));
  const days = [0, 1, 2, 3, 5].map((i) => addDaysKey(SUNDAY, i)).filter((d) => d !== DAY);
  const week = days.map((d, i) => shift({ id: `w${i}`, code: "CMP", startsAt: at(8, 0, d), endsAt: at(16, 0, d) }));
  const mon = shift({ id: "x", code: "CMP", startsAt: at(8, 0, addDaysKey(SUNDAY, 6)), endsAt: at(9, 0, addDaysKey(SUNDAY, 6)) });
  assert.ok(has(run(eight, ctx({ codes: ["CMP", "CMS"], shifts: [...week, mon] })), "cmp_cms_over_40h_week", "block"));
  assert.ok(!has(run(eight, ctx({ codes: ["CMP", "CMS"], shifts: week.slice(0, 3) })), "cmp_cms_over_40h_week"));
  // next week starts Sunday: not counted
  const next = shift({ id: "n", code: "CMP", startsAt: at(8, 0, "2026-10-18"), endsAt: at(16, 0, "2026-10-18") });
  assert.ok(!has(run(eight, ctx({ codes: ["CMP", "CMS"], shifts: [...week.slice(0, 4), next] })), "cmp_cms_over_40h_week"));
});

test("ELS: over 6 h a day, 260 days a year, absence days first", () => {
  const els = (h: number) => shift({ code: "ELS", startsAt: at(8), endsAt: at(8 + h) });
  const c = (o = {}) => ctx({ codes: ["ELS"], client: o });
  assert.ok(has(run(els(7), c()), "els_over_6h_day", "block"));
  assert.ok(!has(run(els(6), c()), "els_over_6h_day"));
  assert.ok(has(run(els(2), c({ elsDaysUsed: 260 })), "els_over_260_days", "block"));
  assert.ok(!has(run(els(2), c({ elsDaysUsed: 259 })), "els_over_260_days"));
  assert.ok(has(run(els(2), c({ absenceDaysLeft: 3 })), "els_absence_days_left", "block"));
  assert.ok(!has(run(els(2), c({ absenceDaysLeft: 0 })), "els_absence_days_left"));
});
