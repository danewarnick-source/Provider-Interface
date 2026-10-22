import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeGoalViewsOn,
  goalView,
  currentPlan,
  goalLine,
  goalSupportOptions,
  goalsOn,
  nestGoals,
  normalizeCodes,
  planInEffectOn,
  planStatusOn,
  supportsForCode,
  supportsForCodes,
  waitingDays,
  type ClientGoal,
  type ClientPlan,
  type GoalSupport,
} from "./plans.ts";

const NOW = new Date(2026, 9, 6, 12); // Oct 6 2026, local

function plan(p: Partial<ClientPlan> & { id: string }): ClientPlan {
  return {
    client_id: "c1",
    start_date: null,
    end_date: null,
    activated_on: null,
    meeting_date: null,
    status: "current",
    label: null,
    source: "manual",
    document_id: null,
    ...p,
  };
}

function support(s: Partial<GoalSupport> & { id: string; goal_id: string }): GoalSupport {
  return {
    support_text: `Support ${s.id}`,
    details: null,
    start_date: null,
    end_date: null,
    our_codes: [],
    other_providers: [],
    health_needs: [],
    sort: 0,
    ...s,
  };
}

function goal(g: Partial<ClientGoal> & { id: string }): ClientGoal {
  return {
    client_id: "c1",
    plan_id: "p1",
    carried_from_goal_id: null,
    goal_text: `Goal ${g.id}`,
    domain: null,
    current_status: null,
    strengths: null,
    barriers: null,
    success_person: null,
    success_team: null,
    sort: 0,
    status: "active",
    ended_on: null,
    supports: [],
    ...g,
  };
}

const goals: ClientGoal[] = [
  goal({
    id: "g1",
    sort: 1,
    supports: [
      support({ id: "s1", goal_id: "g1", our_codes: ["DSI"] }),
      support({ id: "s2", goal_id: "g1", our_codes: ["HHS", "dsi"], sort: 1 }),
    ],
  }),
  goal({ id: "g2", sort: 0, supports: [support({ id: "s3", goal_id: "g2", our_codes: ["HHS"] })] }),
  goal({ id: "g3", status: "ended", supports: [support({ id: "s4", goal_id: "g3", our_codes: ["DSI"] })] }),
  goal({
    id: "g4",
    sort: 2,
    supports: [support({ id: "s5", goal_id: "g4", our_codes: ["DSI"], end_date: "2026-06-30" })],
  }),
];

describe("supportsForCode", () => {
  it("a DSI shift shows only supports listing DSI, grouped under their goal", () => {
    const r = supportsForCode(goals, "dsi", "2026-10-06");
    assert.deepEqual(r.map((g) => g.goal.id), ["g1"]);
    assert.deepEqual(r[0].supports.map((s) => s.id), ["s1", "s2"]);
  });
  it("an HHS log shows HHS supports, goals in plan order", () => {
    const r = supportsForCode(goals, "HHS");
    assert.deepEqual(r.map((g) => [g.goal.id, g.supports.map((s) => s.id)]), [["g2", ["s3"]], ["g1", ["s2"]]]);
  });
  it("drops ended goals; keeps ended supports only when no date is given", () => {
    assert.deepEqual(supportsForCode(goals, "DSI").map((g) => g.goal.id), ["g1", "g4"]);
    assert.deepEqual(supportsForCode(goals, "DSI", "2026-10-06").map((g) => g.goal.id), ["g1"]);
  });
  it("no code or an unused code → nothing", () => {
    assert.deepEqual(supportsForCode(goals, ""), []);
    assert.deepEqual(supportsForCode(goals, null), []);
    assert.deepEqual(supportsForCode(goals, "SLN"), []);
  });
});

describe("planStatusOn", () => {
  const p = plan({ id: "p", start_date: "2025-11-01", end_date: "2026-10-31" });
  it("before, inside and after the plan year", () => {
    assert.equal(planStatusOn(p, "2025-10-31"), "upcoming");
    assert.equal(planStatusOn(p, "2025-11-01"), "current");
    assert.equal(planStatusOn(p, "2026-10-31"), "current");
    assert.equal(planStatusOn(p, "2026-11-01"), "ended");
  });
  it("undated plans keep their stored status; past stays past", () => {
    assert.equal(planStatusOn(plan({ id: "u", status: "current" }), "2030-01-01"), "current");
    assert.equal(planStatusOn({ ...p, status: "past" }, "2026-01-01"), "past");
  });
});

describe("planInEffectOn / currentPlan / waitingDays", () => {
  const old = plan({ id: "old", start_date: "2024-10-01", end_date: "2025-09-30", status: "past" });
  const last = plan({ id: "last", start_date: "2025-10-01", end_date: "2026-09-30", status: "ended" });
  const next = plan({ id: "next", start_date: "2026-11-01", end_date: "2027-10-31", status: "upcoming" });
  const plans = [old, last, next];

  it("picks the latest plan started by the date", () => {
    assert.equal(planInEffectOn(plans, "2025-03-01")?.plan.id, "old");
    assert.deepEqual(planInEffectOn(plans, "2026-05-01"), { plan: last, status: "current" });
    assert.equal(planInEffectOn(plans, "2026-11-02")?.plan.id, "next");
    assert.equal(planInEffectOn(plans, "2020-01-01"), null);
  });
  it("in the gap after the end date the ended plan still governs, marked ended", () => {
    assert.deepEqual(planInEffectOn(plans, "2026-10-06"), { plan: last, status: "ended" });
    assert.equal(waitingDays(plans, NOW), 6);
  });
  it("no wait while a plan is in effect; null without any dated plan", () => {
    assert.equal(waitingDays([plan({ id: "a", start_date: "2026-01-01", end_date: "2026-12-31" })], NOW), 0);
    assert.equal(waitingDays([plan({ id: "u" })], NOW), null);
    assert.equal(waitingDays([], NOW), null);
  });
  it("currentPlan prefers the row marked current", () => {
    const cur = plan({ id: "cur", status: "current" });
    assert.equal(currentPlan([last, cur], NOW)?.id, "cur");
    assert.equal(currentPlan([old, last], NOW)?.id, "last");
    assert.equal(currentPlan([], NOW), null);
  });
  it("goalsOn returns the goals of the plan in effect that day", () => {
    const bundle = {
      plans: [old, last],
      goals: [goal({ id: "a", plan_id: "old" }), goal({ id: "b", plan_id: "last" })],
    };
    assert.deepEqual(goalsOn(bundle, "2025-01-01").goals.map((g) => g.id), ["a"]);
    const gap = goalsOn(bundle, "2026-10-06");
    assert.equal(gap.status, "ended");
    assert.deepEqual(gap.goals.map((g) => g.id), ["b"]);
    assert.deepEqual(goalsOn(null, "2026-01-01"), { plan: null, status: null, goals: [] });
  });
});

describe("helpers", () => {
  it("normalizeCodes", () => {
    assert.deepEqual(normalizeCodes([" dsi", "DSI", "", null, "hhs"]), ["DSI", "HHS"]);
  });
  it("goalLine joins supports", () => {
    assert.equal(goalLine(supportsForCode(goals, "HHS")[0]), "Goal g2 — supports: Support s3");
  });
  it("nestGoals nests and cleans rows", () => {
    const { supports: _s, ...g1 } = goal({ id: "g1" });
    const nested = nestGoals([g1], [
      { id: "s", goal_id: "g1", support_text: "x", details: null, start_date: null, end_date: null, sort: 0,
        our_codes: ["sln"], other_providers: [{ code: "pac", provider: "Other agency" }], health_needs: null },
    ]);
    assert.deepEqual(nested[0].supports[0].our_codes, ["SLN"]);
    assert.deepEqual(nested[0].supports[0].other_providers, [{ code: "PAC", provider: "Other agency" }]);
    assert.deepEqual(nested[0].supports[0].health_needs, []);
  });
});

describe("goalSupportOptions", () => {
  it("flattens groups into labelled rows", () => {
    const rows = goalSupportOptions([
      { id: "g1", goal: "Cook", supports: [{ id: "s1", support_text: " Model steps " }, { id: "s2", support_text: "" }] },
      { id: "g2", goal: "Walk", supports: [] },
    ]);
    assert.deepEqual(rows, [
      { goalId: "g1", supportId: "s1", goal: "Cook", support: "Model steps", label: "Cook — Model steps" },
      { goalId: "g1", supportId: "s2", goal: "Cook", support: "", label: "Cook" },
    ]);
  });
});

describe("goalView / activeGoalViewsOn", () => {
  it("keeps active goals of the plan in effect with their supports", () => {
    const bundle = { plans: [plan({ id: "p1" })], goals };
    const views = activeGoalViewsOn(bundle, "2026-10-06");
    assert.deepEqual(views.map((v) => v.id), ["g2", "g1", "g4"]);
    assert.deepEqual(views[1].supports.map((s) => s.id), ["s1", "s2"]);
    assert.deepEqual(goalView(goals[0], []).supports, []);
  });
});

describe("supportsForCodes", () => {
  it("merges supports across codes per goal without repeats", () => {
    const r = supportsForCodes(goals, ["hhs", "DSI", "dsi"], "2026-10-06");
    assert.deepEqual(r.map((g) => [g.goal.id, g.supports.map((s) => s.id)]), [["g2", ["s3"]], ["g1", ["s1", "s2"]]]);
    assert.deepEqual(supportsForCodes(goals, []), []);
  });
});
