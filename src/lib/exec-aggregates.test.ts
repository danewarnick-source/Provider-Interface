import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  distinctActiveStaff,
  execAggregateAllowed,
  sumClockedHours,
  usageCounts,
} from "./exec-aggregates.ts";

describe("executive aggregate counts (item 9)", () => {
  it("allows service-role totals only after a successful is_hive_executive check", () => {
    assert.equal(execAggregateAllowed(true, false), true);
    assert.equal(execAggregateAllowed(false, false), false);
    assert.equal(execAggregateAllowed(null, false), false);
    assert.equal(execAggregateAllowed(true, true), false);
  });

  it("returns hours and distinct team-member counts, not timesheet rows", () => {
    const hours = sumClockedHours([
      {
        clock_in_timestamp: "2026-09-01T14:00:00.000Z",
        clock_out_timestamp: "2026-09-01T18:30:00.000Z",
      },
      {
        clock_in_timestamp: "2026-09-02T14:00:00.000Z",
        clock_out_timestamp: null,
      },
      {
        clock_in_timestamp: "2026-09-03T15:00:00.000Z",
        clock_out_timestamp: "2026-09-03T16:00:00.000Z",
      },
    ]);
    assert.equal(hours, 5.5);
    assert.equal(
      distinctActiveStaff([
        { staff_id: "s1" },
        { staff_id: "s1" },
        { staff_id: "s2" },
        { staff_id: null },
      ]),
      2,
    );
    const usage = usageCounts({
      staffCount: 4,
      clientCount: 9,
      hoursLast30d: hours,
      activeStaffLast7d: 2,
    });
    assert.deepEqual(Object.keys(usage).sort(), [
      "active_staff_last_7d",
      "client_count",
      "hours_last_30d",
      "staff_count",
    ]);
    assert.equal("rows" in usage, false);
  });

  it("reads client counts and evv timesheets with the service role behind is_hive_executive", () => {
    const src = readFileSync(new URL("./hive-exec.functions.ts", import.meta.url), "utf8");
    assert.match(src, /is_hive_executive/);
    assert.match(src, /supabaseAdmin/);
    assert.match(src, /loadExecUsageAggregates/);
    const loader = src.slice(src.indexOf("async function loadExecUsageAggregates"));
    assert.match(loader, /from\("clients"\)/);
    assert.match(loader, /from\("evv_timesheets"\)/);
    assert.match(loader, /head: true/);
    assert.doesNotMatch(loader, /first_name|last_name|narrative/);
  });
});
