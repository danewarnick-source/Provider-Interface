import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePcsp } from "./parser.ts";
import { proposeCarryOver } from "./carry-over.ts";
import { initialReview, otherProvidersFrom, checkGroups, reviewSummary, unitTypeFor } from "./review.ts";
import { SAMPLE_AGENCY, SAMPLE_PCSP_PAGES } from "./fixture/sample-pages.ts";

const parse = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
const current = [{ id: "g-cook", goal_text: "Pat will cook a simple meal each week." }];
const carry = proposeCarryOver(parse.goals.map((g) => g.goal), current, parse.lastYearGoals);

test("unit type from the PCSP's unit text, falling back on the code", () => {
  assert.equal(unitTypeFor("DSI", "15 Minutes"), "Q");
  assert.equal(unitTypeFor("HHS", "Daily"), "day");
  assert.equal(unitTypeFor("XYZ", "Hourly"), "hourly");
  assert.equal(unitTypeFor("HHS", undefined), "day");
  assert.equal(unitTypeFor("DSI", ""), "Q");
});

test("review starts with our budget lines only, goals carried over as proposed", () => {
  const r = initialReview(parse, carry);
  assert.deepEqual(r.budget.map((b) => [b.code, b.unitType, b.annualUnits]), [["DSI", "Q", 2000], ["HHS", "day", 365], ["SEI", "Q", 1040]]);
  assert.deepEqual(r.goals.map((g) => g.carry.kind), ["carried", "new"]);
  assert.equal(r.goals[0].carry.fromGoalId, "g-cook");
  assert.equal(r.goals[0].supports.length, 3);
  assert.deepEqual(r.otherNeeds.map((n) => [n.support, n.include]), [
    ["Behavior support plan for Pat at home.", false],
    ["Host home helps Pat with daily living.", true],
    ["Annual dental visit.", false],
  ]);
  assert.deepEqual(r.plan, { start: "2026-09-01", end: "2027-08-31", activatedOn: "2026-08-20", meetingDate: "2026-08-15" });
});

test("the other agency's behavior provider becomes a contact, named by the non-goal support", () => {
  assert.deepEqual(otherProvidersFrom(parse), [
    { include: true, code: "BC2", provider: "Sample Behavior Group Inc", note: "Behavior support plan for Pat at home." },
  ]);
});

test("summary counts kept goals and our budget", () => {
  const r = initialReview(parse, carry);
  assert.deepEqual(reviewSummary(parse, r), {
    goals: 2, supports: 5, supportsForUs: 3, carried: 1, newGoals: 1, budgetTotalForUs: 70420,
  });
  r.goals[1].include = false;
  assert.equal(reviewSummary(parse, r).goals, 1);
});

test("issues are grouped: fix before confirming, then check these, by page", () => {
  const { fix, check } = checkGroups(parse.issues);
  assert.deepEqual(fix.map((i) => i.page), [7]);
  assert.deepEqual(check.map((i) => [i.level, i.page ?? null]), [["warn", 3], ["warn", 5], ["warn", 6], ["warn", null]]);
  const withInfo = checkGroups([...parse.issues, { level: "info", page: 1, message: "note" }]);
  assert.equal(withInfo.check.at(-1)?.level, "info");
});
