import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ACCOUNT_CHANGE_TYPES,
  ACTIVITY_FILTER_LABEL,
  ACTIVITY_FILTERS,
  buildActivityItems,
  filterActivity,
  type MemberActivityData,
} from "./activity.ts";

const DATA: MemberActivityData = {
  shifts: [
    {
      id: "t1",
      client_id: "c1",
      client_name: "Tommy",
      service_type_code: "SLN",
      status: "approved",
      clock_in_timestamp: "2026-09-10T15:00:00Z",
      clock_out_timestamp: "2026-09-10T19:00:00Z",
      billed_units: 16,
    },
    {
      id: "t2",
      client_id: null,
      client_name: null,
      service_type_code: null,
      status: null,
      clock_in_timestamp: null,
      clock_out_timestamp: null,
      billed_units: null,
    },
  ],
  forms: [
    {
      id: "f1",
      form_name: "Med count",
      status: null,
      submitted_at: "2026-09-12T00:00:00Z",
      created_at: null,
    },
  ],
  incidents: [
    {
      id: "i1",
      report_number: "IR-7",
      status: "filed",
      incident_date: "2026-09-01",
      filed_at: null,
      incident_types: ["Fall", "Injury"],
    },
  ],
  account: [
    {
      id: "a1",
      change_type: "invite_sent",
      changed_by_name: "Dane",
      created_at: "2026-09-15T00:00:00Z",
    },
    {
      id: "a2",
      change_type: "preset_edited",
      changed_by_name: "Dane",
      created_at: "2026-09-16T00:00:00Z",
    },
    {
      id: "a3",
      change_type: "deactivated",
      changed_by_name: "Unknown",
      created_at: "2026-09-05T00:00:00Z",
    },
  ],
};

describe("activity", () => {
  it("chips: All · Shifts · Forms · Incidents · Account", () => {
    assert.deepEqual(
      ACTIVITY_FILTERS.map((f) => ACTIVITY_FILTER_LABEL[f]),
      ["All", "Shifts", "Forms", "Incidents", "Account"],
    );
    assert.deepEqual(
      [...ACCOUNT_CHANGE_TYPES],
      [
        "member_created",
        "invite_sent",
        "member_access",
        "password_reset",
        "deactivated",
        "reactivated",
      ],
    );
  });

  it("one row per timesheet, merged newest first, unknown account types dropped", () => {
    const items = buildActivityItems(DATA);
    assert.deepEqual(
      items.map((i) => i.id),
      ["account-a1", "form-f1", "shift-t1", "account-a3", "incident-i1"],
    );
    const shift = items.find((i) => i.kind === "shift")!;
    assert.equal(shift.title, "SLN");
    assert.equal(shift.detail, "Tommy · 16 u");
    assert.equal(items.find((i) => i.id === "account-a1")?.detail, "by Dane");
    assert.equal(items.find((i) => i.id === "account-a3")?.detail, null);
    assert.equal(items.find((i) => i.kind === "incident")?.detail, "Fall, Injury");
  });

  it("filters by kind", () => {
    const items = buildActivityItems(DATA);
    assert.equal(filterActivity(items, "all").length, 5);
    assert.deepEqual(
      filterActivity(items, "account").map((i) => i.id),
      ["account-a1", "account-a3"],
    );
    assert.equal(filterActivity(items, "form").length, 1);
  });

  it("server reads the four sources and throws on read errors", () => {
    const src = readFileSync(new URL("./activity.functions.ts", import.meta.url), "utf8");
    for (const table of [
      "evv_timesheets",
      "form_submissions",
      "incident_reports",
      "access_change_log",
    ]) {
      assert.match(src, new RegExp(`from\\("${table}"\\)`));
    }
    assert.match(src, /export const getMemberActivity/);
    assert.match(src, /throw new Error/);
  });
});
