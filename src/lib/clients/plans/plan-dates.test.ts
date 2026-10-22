import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysYmd,
  planYearRows,
  strategiesDueOn,
} from "./plan-dates.ts";
import type { ClientPlan } from "./plans.ts";

const NOW = new Date(2026, 9, 6); // Oct 6, 2026, local

function plan(over: Partial<ClientPlan>): ClientPlan {
  return {
    id: "p1",
    client_id: "c1",
    start_date: "2025-10-01",
    end_date: "2026-09-30",
    activated_on: null,
    meeting_date: null,
    status: "current",
    label: null,
    source: "manual",
    document_id: null,
    ...over,
  };
}

describe("strategiesDueOn", () => {
  it("is the current plan's activation date plus 30 days", () => {
    assert.equal(strategiesDueOn(plan({ activated_on: "2026-09-20" })), "2026-10-20");
    assert.equal(strategiesDueOn(plan({ activated_on: "2026-12-15" })), "2027-01-14");
  });
  it("is unknown without an activation date", () => {
    assert.equal(strategiesDueOn(plan({ activated_on: null })), null);
    assert.equal(strategiesDueOn(null), null);
  });
  it("adds calendar days", () => {
    assert.equal(addDaysYmd("2026-02-27", 2), "2026-03-01");
    assert.equal(addDaysYmd("not a date", 2), null);
  });
});

describe("planYearRows", () => {
  it("labels current, upcoming, ended-and-waiting and past plan years", () => {
    const rows = planYearRows(
      [
        plan({ id: "old", start_date: "2024-10-01", end_date: "2025-09-30", status: "past" }),
        plan({ id: "ended" }),
        plan({ id: "next", start_date: "2026-11-01", end_date: "2027-10-31", status: "upcoming" }),
      ],
      NOW,
    );
    assert.deepEqual(rows.map((r) => [r.plan.id, r.kind, r.waitingDays]), [
      ["next", "upcoming", null],
      ["ended", "waiting", 6],
      ["old", "past", null],
    ]);
    const current = planYearRows([plan({ start_date: "2026-01-01", end_date: "2026-12-31" })], NOW)[0];
    assert.equal(current.kind, "current");
    assert.equal(current.daysLeft, 86);
  });
});
