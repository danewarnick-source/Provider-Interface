import test from "node:test";
import assert from "node:assert/strict";
import { DAY, at, auth, ctx, evidence, has, shift, ALL_KEYS } from "./rules-fixtures.ts";
import { evaluateShift } from "./rules.ts";
import { addDaysKey } from "./time.ts";

const run = (s = shift(), c = ctx()) => evaluateShift(s, c);
const NEXT = addDaysKey(DAY, 1);

test("weekly hours below the Worksheet warn", () => {
  const c = (t: number) => ctx({ client: { authorizations: [auth("SLH", { weeklyHoursTarget: t })] } });
  assert.ok(has(run(shift(), c(10)), "below_worksheet_hours", "warn"));
  assert.ok(!has(run(shift(), c(2)), "below_worksheet_hours"));
});

test("under 8 hours of rest warns (Agency), and the agency can turn it off or make it a block", () => {
  const prev = shift({ id: "p", startsAt: at(0), endsAt: at(3) });
  assert.ok(has(run(shift(), ctx({ shifts: [prev] })), "under_rest", "warn"));
  const ok = shift({ id: "p", startsAt: at(0), endsAt: at(1) });
  assert.ok(!has(run(shift(), ctx({ shifts: [ok] })), "under_rest"));
  const off = ctx({ shifts: [prev], settings: { rules: { under_rest: "off" } } });
  assert.ok(!has(run(shift(), off), "under_rest"));
  const blk = ctx({ shifts: [prev], settings: { rules: { under_rest: "block" } } });
  assert.ok(has(run(shift(), blk), "under_rest", "block"));
});

test("over 16 hours straight warns", () => {
  const long = shift({ id: "o", startsAt: at(11), endsAt: at(3, 0, NEXT) });
  assert.ok(has(run(shift(), ctx({ shifts: [long] })), "over_16h_straight", "warn"));
  const short = shift({ id: "o", startsAt: at(11), endsAt: at(23) });
  assert.ok(!has(run(shift(), ctx({ shifts: [short] })), "over_16h_straight"));
});

test("overtime past the weekly threshold warns", () => {
  const others = [0, 1, 2, 3, 5].map((i) => addDaysKey("2026-10-11", i)).filter((d) => d !== DAY)
    .map((d, i) => shift({ id: `w${i}`, startsAt: at(8, 0, d), endsAt: at(18, 0, d) }));
  assert.ok(has(run(shift(), ctx({ shifts: others })), "overtime", "warn"));
  assert.ok(!has(run(shift(), ctx({ shifts: others.slice(0, 2) })), "overtime"));
  const high = ctx({ shifts: others, settings: { overtimeThresholdHours: 60 } });
  assert.ok(!has(run(shift(), high), "overtime"));
});

test("rolling 16 hours in 24 warns, counting a holdover and outside hours", () => {
  const next = shift({ id: "o", startsAt: at(12), endsAt: at(23) });
  assert.ok(!has(run(shift(), ctx({ shifts: [next] })), "fatigue_16_in_24"));
  const outside = ctx({ shifts: [next], staff: { outsideHours: { [DAY]: 5 } } });
  assert.ok(has(run(shift(), outside), "fatigue_16_in_24", "warn"));
  const hold = shift({ id: "o", startsAt: at(12), endsAt: at(5, 0, NEXT), holdover: true });
  const f = run(shift(), ctx({ shifts: [hold] })).find((x) => x.rule === "fatigue_16_in_24");
  assert.ok(f && /holdover/.test(f.message));
});

test("travel gap under 20 minutes between addresses warns; agency can change the minutes", () => {
  const a = shift({ address: "1 Elm St" });
  const near = shift({ id: "o", startsAt: at(11, 10), endsAt: at(12), address: "9 Oak Ave" });
  assert.ok(has(run(a, ctx({ shifts: [near] })), "travel_gap", "warn"));
  const far = shift({ id: "o", startsAt: at(11, 30), endsAt: at(12), address: "9 Oak Ave" });
  assert.ok(!has(run(a, ctx({ shifts: [far] })), "travel_gap"));
  const same = shift({ id: "o", startsAt: at(11, 10), endsAt: at(12), address: "1 Elm St" });
  assert.ok(!has(run(a, ctx({ shifts: [same] })), "travel_gap"));
  assert.ok(has(run(a, ctx({ shifts: [far], settings: { travelGapMinutes: 45 } })), "travel_gap"));
});

test("client staffing preferences warn by default, block when the agency says so (Decision 25)", () => {
  const pref = (block?: boolean) => ctx({
    client: { preferences: [{ key: "g", label: "a female team member for personal care", requiresStaffGender: "female", block }] },
    staff: { gender: "male" },
  });
  assert.ok(has(run(shift(), pref()), "client_preference", "warn"));
  assert.ok(has(run(shift(), pref(true)), "client_preference", "block"));
  const match = ctx({ client: { preferences: [{ key: "g", label: "x", requiresStaffGender: "female" }] }, staff: { gender: "female" } });
  assert.ok(!has(run(shift(), match), "client_preference"));
});

test("assumed ratio warns, then blocks 15 days after the authorization was approved (Decision 13)", () => {
  const g = shift({ clientId: null, code: "DSG", groupClientIds: ["c1"], groupStaffCount: 1 });
  const c = (approvedOn: string, confirmed?: boolean) => ctx({
    client: {
      authorizations: [auth("DSG", { approvedOn })],
      ratios: confirmed ? [{ code: "DSG", staff: 1, clients: 6, confirmed: true }] : [],
    },
  });
  assert.ok(has(run(g, c("2026-10-01")), "assumed_ratio", "warn")); // day 13
  assert.ok(has(run(g, c("2026-09-29")), "assumed_ratio", "block")); // day 15
  assert.ok(!has(run(g, c("2026-09-01", true)), "assumed_ratio"));
});

test("time-window requirement ('7-9 a.m.: 1 med-trained') is checked through Evidence", () => {
  const req = [{ from: "07:00", to: "09:00", qualificationKey: "med_trained", label: "med-trained", count: 1 }];
  const slot = shift({ clientId: null, code: "RHS", startsAt: at(6), endsAt: at(14), windowRequirements: req });
  assert.ok(has(run(slot, ctx()), "window_qualification", "warn"));
  const trained = ctx({ evidence: { s1: evidence([...ALL_KEYS, "med_trained"]), s2: evidence(ALL_KEYS) } });
  assert.ok(!has(run(slot, trained), "window_qualification"));
  const expired = ctx({ evidence: { s1: evidence([...ALL_KEYS, "med_trained"], { med_trained: { expires: "2026-10-01" } }), s2: evidence(ALL_KEYS) } });
  assert.ok(has(run(slot, expired), "window_qualification"));
});

test("outside the availability a person gave warns", () => {
  const avail = { 3: [["12:00", "18:00"]] as const };
  assert.ok(has(run(shift(), ctx({ staff: { availability: avail } })), "outside_availability", "warn"));
  const inside = { 3: [["08:00", "12:00"]] as const };
  assert.ok(!has(run(shift(), ctx({ staff: { availability: inside } })), "outside_availability"));
  assert.ok(!has(run(shift(), ctx()), "outside_availability"));
});

