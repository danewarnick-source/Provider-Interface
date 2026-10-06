import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { noteAddressesAny, noteAddressesGoal, summaryGoals } from "./plan-summaries.ts";
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
    assert.deepEqual(q4.goals, [{ id: "a", goal: "Goal a", job_codes: ["HHS"], supports: ["Support s0"] }]);
    const q1 = summaryGoals(bundle, "2026-03-31", ["dsi"]);
    assert.deepEqual(q1.goals, [
      { id: "c", goal: "Goal c", job_codes: ["DSI"], supports: [] },
      { id: "b", goal: "Goal b", job_codes: ["DSI"], supports: ["Support s2"] },
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
