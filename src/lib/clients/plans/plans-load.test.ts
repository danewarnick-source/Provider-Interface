import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadPlanBundle, loadPlanBundles } from "./plans-load.ts";

type Rows = Record<string, Array<Record<string, unknown>>>;

function fakeSupabase(rows: Rows, calls: string[] = []) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            in(col: string, ids: string[]) {
              calls.push(`${table}.${col}`);
              return Promise.resolve({ data: (rows[table] ?? []).filter((r) => ids.includes(String(r[col]))), error: null });
            },
          };
        },
      };
    },
  };
}

const rows: Rows = {
  client_plans: [
    { id: "p1", client_id: "a", status: "current", start_date: "2026-01-01", end_date: "2026-12-31" },
    { id: "p2", client_id: "b", status: "current", start_date: null, end_date: null },
  ],
  client_goals: [
    { id: "g2", client_id: "a", plan_id: "p1", goal_text: "Second", sort: 1, status: "active" },
    { id: "g1", client_id: "a", plan_id: "p1", goal_text: "First", sort: 0, status: "active" },
  ],
  client_goal_supports: [
    { id: "s1", goal_id: "g1", support_text: "Help", our_codes: ["dsi"], other_providers: [], health_needs: [], sort: 0 },
  ],
};

describe("loadPlanBundles", () => {
  it("groups plans and nested goals by client; every client present", async () => {
    const map = await loadPlanBundles(fakeSupabase(rows), ["a", "b", "c", "a"]);
    assert.deepEqual([...map.keys()], ["a", "b", "c"]);
    assert.deepEqual(map.get("a")!.goals.map((g) => g.id), ["g1", "g2"]);
    assert.deepEqual(map.get("a")!.goals[0].supports[0].our_codes, ["DSI"]);
    assert.equal(map.get("b")!.plans.length, 1);
    assert.deepEqual(map.get("c"), { plans: [], goals: [] });
  });
  it("skips the supports query when there are no goals, and all queries with no ids", async () => {
    const calls: string[] = [];
    await loadPlanBundle(fakeSupabase(rows, calls), "b");
    assert.deepEqual(calls, ["client_plans.client_id", "client_goals.client_id"]);
    const none: string[] = [];
    assert.equal((await loadPlanBundles(fakeSupabase(rows, none), [])).size, 0);
    assert.deepEqual(none, []);
  });
  it("throws on a query error", async () => {
    const bad = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) };
    await assert.rejects(loadPlanBundles(bad, ["a"]), /boom/);
  });
});
