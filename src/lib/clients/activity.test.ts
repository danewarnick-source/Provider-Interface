import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activityFilters,
  buildTimeline,
  filterTimeline,
  previewText,
  shiftHours,
} from "./activity.ts";

const sources = {
  shifts: [
    {
      id: "s1",
      clock_in_timestamp: "2026-10-03T15:00:00Z",
      staff_id: "u1",
      service_type_code: "SLH",
      shift_note_text: "Went to the park.",
    },
  ],
  logs: [{ id: "l1", log_date: "2026-10-04", user_id: "u2", narrative: null }],
  incidents: [
    {
      id: "i1",
      incident_date: "2026-10-01",
      reported_by: "u3",
      incident_types: ["Fall"],
      description: "Slipped, no injury.",
    },
  ],
};

describe("activity timeline", () => {
  const all = { canSeeIncidents: true };

  it("merges every kind, newest first", () => {
    const t = buildTimeline(sources, all);
    assert.deepEqual(
      t.map((e) => e.key),
      ["daily_log:l1", "shift:s1", "incident:i1"],
    );
    assert.equal(t[1].code, "SLH");
    assert.equal(t[0].preview, "No note text.");
    assert.equal(t[2].preview, "Fall: Slipped, no injury.");
  });

  it("incidents are hidden (rows and pill) from people without Incidents: View", () => {
    const staff = { canSeeIncidents: false };
    assert.deepEqual(
      buildTimeline(sources, staff).map((e) => e.kind),
      ["daily_log", "shift"],
    );
    assert.deepEqual(
      activityFilters(staff).map((f) => f.label),
      ["All", "Shift notes", "Daily logs"],
    );
  });

  it("filters by pill", () => {
    const t = buildTimeline(sources, all);
    assert.deepEqual(
      filterTimeline(t, "incident").map((e) => e.id),
      ["i1"],
    );
    assert.equal(filterTimeline(t, "all").length, 3);
    assert.deepEqual(
      activityFilters(all).map((f) => f.value),
      ["all", "shift", "daily_log", "incident"],
    );
  });

  it("previews are one line and trimmed", () => {
    assert.equal(previewText("  a\n\n b ", "-"), "a b");
    assert.equal(previewText("", "Empty"), "Empty");
    assert.equal(previewText("x".repeat(400), "-").length, 160);
  });

  it("shift hours round to one decimal and are null while open or backwards", () => {
    assert.equal(shiftHours("2026-01-01T08:00:00Z", "2026-01-01T10:20:00Z"), 2.3);
    assert.equal(shiftHours("2026-01-01T08:00:00Z", null), null);
    assert.equal(shiftHours("2026-01-01T10:00:00Z", "2026-01-01T08:00:00Z"), null);
  });
});
