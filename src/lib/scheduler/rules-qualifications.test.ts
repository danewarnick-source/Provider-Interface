import test from "node:test";
import assert from "node:assert/strict";
import { ALL_KEYS, DAY, at, client, ctx, evidence, has, shift, staff } from "./rules-fixtures.ts";
import { evaluateShift } from "./rules.ts";
import { CPR_KEY, qualificationsOnDate, type QualState } from "./rules-qualifications.ts";

const SH = { code: "SLH", startsAt: at(9) };
const stateOf = (ev: ReturnType<typeof evidence> | undefined, key = CPR_KEY, who = staff(), extras = {}): QualState =>
  qualificationsOnDate(who, SH, ev, extras).find((r) => r.key === key)!.state;
const without = (key: string) => ALL_KEYS.filter((k) => k !== key);

test("a reviewed, unexpired card is valid", () => {
  assert.equal(stateOf(evidence(ALL_KEYS)), "valid");
});

test("an uploaded card waiting for review is its own state and never clears the reminder", () => {
  const ev = evidence(ALL_KEYS, { [CPR_KEY]: { review: "pending" } });
  assert.equal(stateOf(ev), "waiting_review");
  const r = qualificationsOnDate(staff(), SH, ev).find((x) => x.key === CPR_KEY)!;
  assert.match(r.message, /New card uploaded, waiting for review/);
  assert.ok(r.fix);
  const c = ctx({ evidence: { s1: ev, s2: evidence(ALL_KEYS) } });
  assert.ok(has(evaluateShift(shift(), c), "cpr_first_aid", "warn"));
});

test("a card sent back is a reminder too", () => {
  assert.equal(stateOf(evidence(ALL_KEYS, { [CPR_KEY]: { review: "sent_back" } })), "sent_back");
});

test("expiring before the shift date is expired; expiring on or after it is valid", () => {
  assert.equal(stateOf(evidence(ALL_KEYS, { [CPR_KEY]: { expires: "2026-10-13" } })), "expired");
  assert.equal(stateOf(evidence(ALL_KEYS, { [CPR_KEY]: { expires: DAY } })), "valid");
  assert.equal(stateOf(evidence(ALL_KEYS, { [CPR_KEY]: { expires: "2026-10-15" } })), "valid");
  // the same card is fine for an earlier shift and expired for a later one
  const ev = evidence(ALL_KEYS, { [CPR_KEY]: { expires: "2026-10-20" } });
  const on = (ymd: string) => qualificationsOnDate(staff(), { code: "SLH", startsAt: at(9, 0, ymd) }, ev).find((r) => r.key === CPR_KEY)!.state;
  assert.equal(on("2026-10-19"), "valid");
  assert.equal(on("2026-10-21"), "expired");
});

test("missing card links to that person's Evidence row", () => {
  const r = qualificationsOnDate(staff(), SH, evidence(without(CPR_KEY))).find((x) => x.key === CPR_KEY)!;
  assert.equal(r.state, "missing");
  assert.match(r.fix!.label, /Open Maria's Evidence/);
  assert.match(r.fix!.href!, /^\/dashboard\/evidence\?.*person=s1/);
  assert.equal(stateOf(undefined), "missing");
});

test("90-day CPR grace: missing within 90 days of hire is not a reminder, after it is", () => {
  const ev = evidence(without(CPR_KEY));
  assert.equal(stateOf(ev, CPR_KEY, staff({ hireDate: "2026-07-20" })), "grace"); // day 86
  const day90 = qualificationsOnDate(staff({ hireDate: "2026-07-16" }), SH, ev).find((r) => r.key === CPR_KEY)!;
  assert.equal(day90.state, "grace");
  assert.equal(day90.graceUntil, "2026-10-14");
  assert.equal(stateOf(ev, CPR_KEY, staff({ hireDate: "2026-07-15" })), "missing"); // day 91
  const c = ctx({ staff: { hireDate: "2026-07-20" }, evidence: { s1: ev, s2: evidence(ALL_KEYS) } });
  assert.ok(!has(evaluateShift(shift(), c), "cpr_first_aid"));
  const late = ctx({ staff: { hireDate: "2026-01-01" }, evidence: { s1: ev, s2: evidence(ALL_KEYS) } });
  assert.ok(has(evaluateShift(shift(), late), "cpr_first_aid", "warn"));
});

test("an expired CPR card is a reminder even for a new hire", () => {
  const ev = evidence(ALL_KEYS, { [CPR_KEY]: { expires: "2026-09-01" } });
  assert.equal(stateOf(ev, CPR_KEY, staff({ hireDate: "2026-08-01" })), "expired");
});

test("a newer pending upload replaces an older accepted file", () => {
  const ev = evidence(ALL_KEYS);
  ev.files.push({ id: "f2", item_id: `item-${CPR_KEY}`, filename: "new.pdf", uploaded_at: "2026-10-10T00:00:00Z", review_status: "pending" });
  assert.equal(stateOf(ev), "waiting_review");
});

test("general trainings and person-specific training have no hire grace (§1.8(4))", () => {
  const ev = evidence(without("thirty_day_orientation"));
  assert.equal(stateOf(ev, "thirty_day_orientation", staff({ hireDate: "2026-10-01" })), "missing");
  const c = ctx({ evidence: { s1: ev, s2: evidence(ALL_KEYS) } });
  assert.ok(has(evaluateShift(shift(), c), "general_training", "warn"));
});

test("person-specific training reads 'isn't trained for Ben yet (Person-specific)'", () => {
  const c = { ...ctx(), personTrainingKeys: { c1: ["person_c1"] } };
  const f = evaluateShift(shift(), c).find((x) => x.rule === "person_training");
  assert.equal(f?.level, "warn");
  assert.match(f!.message, /Maria isn't trained for Ben yet \(Person-specific\)/);
  const trained = { ...c, evidence: { s1: evidence([...ALL_KEYS, "person_c1"]), s2: evidence(ALL_KEYS) } };
  assert.ok(!has(evaluateShift(shift(), trained), "person_training"));
});

test("code-specific credential: PM1 needs an LPN license, PM2 an RN license", () => {
  for (const [code, key] of [["PM1", "pm1_lpn_license"], ["PM2", "pm2_rn_license"]]) {
    const missing = ctx({ codes: [code], evidence: { s1: evidence(without(key)), s2: evidence(ALL_KEYS) } });
    assert.ok(has(evaluateShift(shift({ code }), missing), "code_qualification", "warn"), code);
    assert.ok(!has(evaluateShift(shift({ code }), ctx({ codes: [code] })), "code_qualification"), code);
  }
});

test("behavior training: due within 180 days of hire, a reminder after", () => {
  const extras = { behaviorSupport: true };
  const ev = evidence(without("mandt_behavior"));
  assert.equal(stateOf(ev, "mandt_behavior", staff({ hireDate: "2026-05-01" }), extras), "grace"); // day 166
  assert.equal(stateOf(ev, "mandt_behavior", staff({ hireDate: "2026-03-01" }), extras), "missing"); // day 227
  const c = ctx({ client: { behaviorSupport: true }, staff: { hireDate: "2026-03-01" }, evidence: { s1: ev, s2: evidence(ALL_KEYS) } });
  assert.ok(has(evaluateShift(shift(), c), "behavior_training", "warn"));
  assert.ok(!has(evaluateShift(shift(), ctx({ client: { behaviorSupport: false }, evidence: { s1: ev, s2: evidence(ALL_KEYS) } })), "behavior_training"));
});

test("driving without a license on file warns", () => {
  const ev = evidence(without("driver_license"));
  const c = ctx({ evidence: { s1: ev, s2: evidence(ALL_KEYS) } });
  assert.ok(has(evaluateShift(shift({ driving: true }), c), "drivers_license", "warn"));
  assert.ok(!has(evaluateShift(shift(), c), "drivers_license"));
  assert.ok(!has(evaluateShift(shift({ driving: true }), ctx()), "drivers_license"));
});

test("a skipped Evidence item is neither valid nor a reminder", () => {
  const ev = evidence(ALL_KEYS);
  ev.items.find((i) => i.requirement_key === CPR_KEY)!.opted_out_at = "2026-01-01T00:00:00Z";
  assert.equal(stateOf(ev), "skipped");
  const c = ctx({ evidence: { s1: ev, s2: evidence(ALL_KEYS) } });
  assert.ok(!has(evaluateShift(shift(), c), "cpr_first_aid"));
});

test("qualification findings are warns, never blocks (Decision 15)", () => {
  const c = ctx({ evidence: { s1: { items: [], files: [] }, s2: evidence(ALL_KEYS) }, staff: { hireDate: "2020-01-01" } });
  const f = evaluateShift(shift({ code: "PM1" }), { ...c, clients: { c1: client({ authorizations: [{ code: "PM1", startDate: "2026-01-01", endDate: null, unitsLeft: 100, approvedOn: null }] }) } });
  const quals = f.filter((x) => ["general_training", "cpr_first_aid", "code_qualification"].includes(x.rule));
  assert.equal(quals.length, 3);
  assert.ok(quals.every((x) => x.level === "warn" && x.fix));
});
