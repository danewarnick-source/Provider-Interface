import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { needsBehaviorSupportPlan } from "./bsp.ts";

const goal = (codes: string[], status: "active" | "ended" = "active") => ({
  status,
  supports: [
    {
      id: "s", goal_id: "g", support_text: "", details: null, start_date: null, end_date: null,
      our_codes: [], health_needs: [], sort: 0,
      other_providers: codes.map((code) => ({ code, provider: "Sample Behavior Group" })),
    },
  ],
});

describe("needsBehaviorSupportPlan", () => {
  it("is true for clients with BC1–BC3 from us", () => {
    assert.equal(needsBehaviorSupportPlan(["SLN", "bc2"]), true);
  });
  it("is true when another agency provides BC on an active goal", () => {
    assert.equal(needsBehaviorSupportPlan(["SLN"], [goal(["BC3"])]), true);
    assert.equal(needsBehaviorSupportPlan(["SLN"], [goal(["BC3"], "ended")]), false);
  });
  it("is false otherwise", () => {
    assert.equal(needsBehaviorSupportPlan(["HHS", "DSI"], [goal(["PN1"])]), false);
  });
});
