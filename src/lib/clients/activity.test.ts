import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activityFilters, buildTimeline, filterTimeline, previewText } from "./activity.ts";

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
  notes: [{ id: "n1", created_at: "2026-10-05T09:00:00Z", created_by: "u4", body: "Call back." }],
};

describe("activity timeline", () => {
  const all = { canSeeIncidents: true, canSeeOfficeNotes: true };

  it("merges every kind, newest first", () => {
    const t = buildTimeline(sources, all);
    assert.deepEqual(
      t.map((e) => e.key),
      ["office_note:n1", "daily_log:l1", "shift:s1", "incident:i1"],
    );
    assert.equal(t[2].code, "SLH");
    assert.equal(t[1].preview, "No note text.");
    assert.equal(t[3].preview, "Fall: Slipped, no injury.");
  });

  it("office notes stay office-only: hidden (rows and pill) from people who can't edit clients", () => {
    const staff = { canSeeIncidents: false, canSeeOfficeNotes: false };
    const t = buildTimeline(sources, staff);
    assert.deepEqual(
      t.map((e) => e.kind),
      ["daily_log", "shift"],
    );
    assert.deepEqual(
      activityFilters(staff).map((f) => f.label),
      ["All", "Shift notes", "Daily logs"],
    );
    const office = buildTimeline(sources, all).find((e) => e.kind === "office_note");
    assert.equal(office?.officeOnly, true);
  });

  it("filters by pill", () => {
    const t = buildTimeline(sources, all);
    assert.deepEqual(
      filterTimeline(t, "incident").map((e) => e.id),
      ["i1"],
    );
    assert.equal(filterTimeline(t, "all").length, 4);
    assert.deepEqual(
      activityFilters(all).map((f) => f.value),
      ["all", "shift", "daily_log", "incident", "office_note"],
    );
  });

  it("previews are one line and trimmed", () => {
    assert.equal(previewText("  a\n\n b ", "-"), "a b");
    assert.equal(previewText("", "Empty"), "Empty");
    assert.equal(previewText("x".repeat(400), "-").length, 160);
  });
});
