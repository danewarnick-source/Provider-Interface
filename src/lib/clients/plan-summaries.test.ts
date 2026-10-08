import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currentSummaryPeriod,
  noteAddressesAny,
  noteAddressesGoal,
  summaryButtonLabel,
  summaryGoals,
  summaryPeriodName,
} from "./plan-summaries.ts";
import type { ClientGoal, ClientPlan, ClientPlanBundle } from "./plans.ts";

const plan = (id: string, start: string, end: string): ClientPlan => ({
  id, client_id: "c", start_date: start, end_date: end, activated_on: null, meeting_date: null,
  status: "current", label: null, source: "manual", document_id: null,
});
const support = (id: string, goal_id: string, our_codes: string[], support_text = `Support ${id}`) => ({
  id, goal_id, support_text, details: null, start_date: null, end_date: null, our_codes,
  other_providers: [], health_needs: [], sort: 0,
});
const goal = (id: string, plan_id: string, supports: ClientGoal["supports"], sort = 0): ClientGoal => ({
  id, client_id: "c", plan_id, carried_from_goal_id: null, goal_text: `Goal ${id}`, domain: null,
  current_status: null, strengths: null, barriers: null, success_person: null, success_team: null,
  sort, status: "active", ended_on: null, supports,
});

const bundle: ClientPlanBundle = {
  plans: [plan("old", "2025-01-01", "2025-12-31"), plan("new", "2026-01-01", "2026-12-31")],
  goals: [
    goal("a", "old", [support("s0", "a", ["HHS"])]),
    goal("b", "new", [support("s1", "b", ["HHS"]), support("s2", "b", ["DSI"])], 1),
    goal("c", "new", [support("s3", "c", ["DSI"], " ")], 0),
  ],
};

describe("summaryGoals", () => {
  it("uses the plan in effect at the period end and the summary's codes", () => {
    const q4 = summaryGoals(bundle, "2025-12-31", ["HHS"]);
    assert.equal(q4.planId, "old");
    assert.deepEqual(q4.goals, [{ id: "a", goal: "Goal a", job_codes: ["HHS"], supports: [{ support: "Support s0", details: "", codes: ["HHS"] }] }]);
    const q1 = summaryGoals(bundle, "2026-03-31", ["dsi"]);
    assert.deepEqual(q1.goals, [
      { id: "c", goal: "Goal c", job_codes: ["DSI"], supports: [] },
      { id: "b", goal: "Goal b", job_codes: ["DSI"], supports: [{ support: "Support s2", details: "", codes: ["DSI"] }] },
    ]);
  });
  it("supports carry their details and codes; blank supports drop out", () => {
    const b: ClientPlanBundle = {
      plans: [plan("p", "2026-01-01", "2026-12-31")],
      goals: [goal("x", "p", [{ ...support("s1", "x", ["SLN"], " Coaching "), details: " Twice a week " }, support("s2", "x", ["SLN"], " ")])],
    };
    assert.deepEqual(summaryGoals(b, "2026-12-31", ["SLN"]).goals[0].supports, [
      { support: "Coaching", details: "Twice a week", codes: ["SLN"] },
    ]);
  });

  it("no codes → every goal with all supports; no plan → nothing", () => {
    assert.deepEqual(summaryGoals(bundle, "2026-03-31", []).goals.map((g) => [g.id, g.job_codes]), [["c", ["DSI"]], ["b", ["DSI", "HHS"]]]);
    assert.deepEqual(summaryGoals(null, "2026-03-31", ["HHS"]), { planId: null, goals: [] });
  });
});

describe("noteAddressesGoal", () => {
  const g = { id: "b", goal: "Cook a meal" };
  it("matches by id, goal text, or 'goal — support' label", () => {
    assert.equal(noteAddressesGoal({ goal_ids: ["b"] }, g), true);
    assert.equal(noteAddressesGoal({ addressed: [" cook a MEAL "] }, g), true);
    assert.equal(noteAddressesGoal({ addressed: ["Cook a meal — Model steps"] }, g), true);
    assert.equal(noteAddressesGoal({ addressed: ["Cook a meal tonight"] }, g), false);
    assert.equal(noteAddressesGoal({}, g), false);
    assert.equal(noteAddressesAny({ goal_ids: ["x"] }, [g, { id: "x", goal: "Other" }]), true);
  });
});

describe("summary names on buttons", () => {
  it("names quarters and months", () => {
    assert.equal(summaryPeriodName("2026-Q4"), "Q4 2026");
    assert.equal(summaryPeriodName("2026-10"), "Oct 2026");
    assert.equal(summaryPeriodName("2026-10-FS"), "Oct 2026");
    assert.equal(summaryPeriodName("weird"), null);
  });
  it("opens a draft and views a finalized one", () => {
    assert.equal(summaryButtonLabel({ period_label: "2026-Q4", status: "draft" }), "Open Q4 2026 summary");
    assert.equal(summaryButtonLabel({ period_label: "2026-Q3", status: "finalized" }), "View Q3 2026 summary");
    assert.equal(summaryButtonLabel({ period_label: null, status: "pending" }), "Open summary");
  });
  it("starts this quarter's summary, or this month's when a code owes monthly ones", () => {
    const now = new Date(2026, 9, 7);
    assert.deepEqual(currentSummaryPeriod(["quarterly"], now), { kind: "quarterly", label: "2026-Q4" });
    assert.deepEqual(currentSummaryPeriod(["quarterly", "monthly"], now), { kind: "monthly", label: "2026-10" });
  });
});
