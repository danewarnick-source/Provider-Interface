import test from "node:test";
import assert from "node:assert/strict";
import { ALL_KEYS, at, ctx, evidence, has, shift } from "./rules-fixtures.ts";
import { evaluateShift } from "./rules.ts";
import {
  applyStrength,
  refusalLine,
  ruleKind,
  strengthChoices,
  verdictOf,
} from "./rules-strength.ts";

const run = (s = shift(), c = ctx()) => evaluateShift(s, c);
const prev = shift({ id: "p", startsAt: at(0), endsAt: at(3) });

test("contract rules have no Off; fixed rules are Block only; agency and card rules have all four", () => {
  assert.deepEqual(strengthChoices("no_authorization"), ["block"]);
  assert.deepEqual(strengthChoices("staff_double_booked"), ["block"]);
  assert.deepEqual(strengthChoices("not_on_team"), ["warn", "reason", "block"]);
  assert.deepEqual(strengthChoices("under_rest"), ["off", "warn", "reason", "block"]);
  assert.deepEqual(strengthChoices("cpr_first_aid"), ["off", "warn", "reason", "block"]);
  assert.equal(ruleKind("driver_file"), "card");
});

test("double-booking always blocks, even when the setting says warn or off", () => {
  const other = shift({ id: "o", clientId: null, teamId: "t2" });
  for (const s of ["warn", "off"] as const) {
    assert.ok(
      has(
        run(shift(), ctx({ shifts: [other], settings: { rules: { staff_double_booked: s } } })),
        "staff_double_booked",
        "block",
      ),
    );
  }
});

test("a contract rule set to Off keeps its default level", () => {
  const off = ctx({ client: { teamStaffIds: [] }, settings: { rules: { not_on_team: "off" } } });
  assert.ok(has(run(shift(), off), "not_on_team", "block"));
  const warn = ctx({ client: { teamStaffIds: [] }, settings: { rules: { not_on_team: "warn" } } });
  assert.ok(has(run(shift(), warn), "not_on_team", "warn"));
});

test("cards default to Warn and the agency can make them Block", () => {
  const noCpr = { s1: evidence(ALL_KEYS.filter((k) => k !== "cpr_first_aid")) };
  assert.ok(has(run(shift(), ctx({ evidence: noCpr })), "cpr_first_aid", "warn"));
  assert.ok(
    has(
      run(shift(), ctx({ evidence: noCpr, settings: { rules: { cpr_first_aid: "block" } } })),
      "cpr_first_aid",
      "block",
    ),
  );
});

test("Require a reason stops the action until a reason is typed", () => {
  const c = ctx({ shifts: [prev], settings: { rules: { under_rest: "reason" } } });
  const f = run(shift(), c);
  assert.ok(has(f, "under_rest", "reason"));
  const without = verdictOf(f);
  assert.equal(without.needReason.length, 1);
  assert.match(refusalLine(without) ?? "", /^Add a reason to go ahead: .*rest/);
  const withReason = verdictOf(f, "Covering a call-out");
  assert.equal(withReason.needReason.length, 0);
  assert.equal(refusalLine(withReason), null);
  assert.ok(withReason.warnings.some((w) => w.rule === "under_rest"));
});

test("applyStrength drops Off agency rules and ignores choices a rule doesn't allow", () => {
  const f = [
    { rule: "overtime", level: "warn" as const, message: "x" },
    { rule: "no_authorization", level: "block" as const, message: "y" },
  ];
  assert.deepEqual(
    applyStrength(f, { overtime: "off", no_authorization: "warn" }).map((x) => [x.rule, x.level]),
    [["no_authorization", "block"]],
  );
});

test("refusalLine shows the first block and counts the rest", () => {
  const v = verdictOf([
    { rule: "a", level: "block", message: "First" },
    { rule: "b", level: "block", message: "Second" },
  ]);
  assert.equal(refusalLine(v), "First (+1 more)");
});
