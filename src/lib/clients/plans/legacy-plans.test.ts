import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { legacyGoalsForClient, legacyPlanForClient } from "./legacy-plans.ts";

const TODAY = "2026-10-06";

describe("legacyPlanForClient (backfill mapping)", () => {
  it("reads a MM/DD/YYYY - MM/DD/YYYY plan year", () => {
    assert.deepEqual(legacyPlanForClient({ plan_year: "11/1/2025 - 10/31/2026", pcsp_expiration_date: null }, TODAY), {
      start_date: "2025-11-01", end_date: "2026-10-31", status: "current", label: "11/1/2025 - 10/31/2026",
    });
  });
  it("falls back to the expiration date (start = a year before)", () => {
    assert.deepEqual(legacyPlanForClient({ plan_year: "2025-2026", pcsp_expiration_date: "2026-09-30" }, TODAY), {
      start_date: "2025-10-01", end_date: "2026-09-30", status: "ended", label: "2025-2026",
    });
  });
  it("a bare year label stays undated and current", () => {
    assert.deepEqual(legacyPlanForClient({ plan_year: " 2026-2027 ", pcsp_expiration_date: null }, TODAY), {
      start_date: null, end_date: null, status: "current", label: "2026-2027",
    });
    assert.equal(legacyPlanForClient({ plan_year: null, pcsp_expiration_date: null }, TODAY).label, null);
  });
  it("a plan starting later is upcoming", () => {
    assert.equal(legacyPlanForClient({ plan_year: "01/01/2027 - 12/31/2027", pcsp_expiration_date: null }, TODAY).status, "upcoming");
  });
});

describe("legacyGoalsForClient (backfill mapping)", () => {
  const training = [
    { id: "x", goal: " Cook a meal ", supports: "Staff model steps", details: "Weekly", job_codes: ["dsi", ""] },
    { id: "y", goal: "Walk daily", supports: "", details: "", job_codes: [] },
    { id: "z", goal: "  ", supports: "ignored", job_codes: ["HHS"] },
    "not an object",
  ];
  it("training goals win; each becomes one support with its codes", () => {
    assert.deepEqual(legacyGoalsForClient(training, ["Flat goal"], ["SLN", "hhs"]), [
      { goal_text: "Cook a meal", sort: 0, support: { support_text: "Staff model steps", details: "Weekly", our_codes: ["DSI"] } },
      { goal_text: "Walk daily", sort: 1, support: { support_text: "", details: null, our_codes: ["HHS", "SLN"] } },
    ]);
  });
  it("flat goals are used when training has none; they get the active codes", () => {
    assert.deepEqual(legacyGoalsForClient([], ["Make a friend", "", "Save money"], ["HHS"]), [
      { goal_text: "Make a friend", sort: 0, support: { support_text: "", details: null, our_codes: ["HHS"] } },
      { goal_text: "Save money", sort: 2, support: { support_text: "", details: null, our_codes: ["HHS"] } },
    ]);
  });
  it("nothing on file → no goals", () => {
    assert.deepEqual(legacyGoalsForClient(null, null, ["HHS"]), []);
  });
});
