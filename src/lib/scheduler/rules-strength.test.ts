import test from "node:test";
import assert from "node:assert/strict";
import { ALL_KEYS, at, ctx, evidence, has, shift } from "./rules-fixtures.ts";
import { evaluateShift } from "./rules.ts";
import {
  applyStrength, FIXED_RULES, refusalLine, SETTING_RULES, settingFor, strengthChoices, strengthOf, verdictOf,
} from "./rules-strength.ts";

const run = (s = shift(), c = ctx()) => evaluateShift(s, c);
const prev = shift({ id: "p", startsAt: at(0), endsAt: at(3) });
const setting = (key: string) => SETTING_RULES.find((r) => r.key === key)!;

test("state rules have no Off; agency rules have all four", () => {
  for (const r of SETTING_RULES) {
    assert.deepEqual(strengthChoices(r), r.state ? ["warn", "reason", "block"] : ["off", "warn", "reason", "block"], r.key);
  }
  assert.equal(setting("card").state, true);
  assert.equal(setting("team").state, false);
  assert.equal(setting("timeoff").state, false);
});

test("under 18 driving, double-booking and no authorization are fixed and not in Settings", () => {
  for (const r of FIXED_RULES) assert.equal(settingFor(r), null, r);
  assert.ok(!SETTING_RULES.some((s) => s.rules.includes("under_minimum_age")));
});

test("the demo's defaults: time off and past the 1056 need a reason, not on the team warns", () => {
  assert.equal(strengthOf(setting("timeoff")), "reason");
  assert.equal(strengthOf(setting("auth")), "reason");
  assert.equal(strengthOf(setting("team")), "warn");
  assert.equal(strengthOf(setting("dns")), "block");
});

test("double-booking always blocks, whatever is stored", () => {
  const other = shift({ id: "o", clientId: null, teamId: "t2" });
  assert.ok(has(run(shift(), ctx({ shifts: [other], settings: { rules: { staff_double_booked: "off" } } })), "staff_double_booked", "block"));
});

test("a home's override wins over the agency default; Off is ignored on a state rule", () => {
  const card = setting("card");
  assert.equal(strengthOf(card, { card: "warn" }, { card: "block" }), "block");
  assert.equal(strengthOf(card, { card: "off" }), "warn");
  const noCpr = { s1: evidence(ALL_KEYS.filter((k) => k !== "cpr_first_aid")) };
  const atHome = ctx({ evidence: noCpr, settings: { rules: { card: "warn" }, homeRules: { t1: { card: "block" } } } });
  assert.ok(has(run(shift(), atHome), "cpr_first_aid", "block"));
  assert.ok(has(run(shift({ teamId: "t2" }), { ...atHome, signedOffHomes: { s1: ["t2"] } }), "cpr_first_aid", "warn"));
});

test("Needs a reason stops the action until a reason is typed", () => {
  const f = run(shift(), ctx({ shifts: [prev], settings: { rules: { rest: "reason" } } }));
  assert.ok(has(f, "under_rest", "reason"));
  const without = verdictOf(f);
  assert.equal(without.needReason.length, 1);
  assert.match(refusalLine(without) ?? "", /^Add a reason to go ahead: .*rest/);
  const withReason = verdictOf(f, "Covering a call-out");
  assert.equal(refusalLine(withReason), null);
  assert.ok(withReason.warnings.some((w) => w.rule === "under_rest"));
});

test("an agency rule set to Off drops its findings; rules in no setting keep their level", () => {
  const f = [{ rule: "overtime", level: "warn" as const, message: "x" }, { rule: "els_over_6h_day", level: "block" as const, message: "y" }];
  assert.deepEqual(applyStrength(f, { ot: "off" }).map((x) => x.rule), ["els_over_6h_day"]);
});

test("refusalLine shows the first block and counts the rest", () => {
  const v = verdictOf([{ rule: "a", level: "block", message: "First" }, { rule: "b", level: "block", message: "Second" }]);
  assert.equal(refusalLine(v), "First (+1 more)");
});
