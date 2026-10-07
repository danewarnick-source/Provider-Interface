import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attentionSummary,
  comingUpItems,
  comingUpWhen,
  lastNotes,
  noteHeading,
  type OverviewNote,
} from "./overview.ts";
import type { AttentionItem } from "./readiness.ts";

const NOW = new Date(2026, 9, 6, 9, 0);

describe("comingUpItems", () => {
  it("merges shifts and due dates, soonest first, within 30 days", () => {
    const items = comingUpItems(
      {
        shifts: [
          {
            id: "s2",
            starts_at: new Date(2026, 9, 8, 15).toISOString(),
            service_code: "SLN",
            staffName: "Sam Test",
          },
          {
            id: "s1",
            starts_at: new Date(2026, 9, 7, 8).toISOString(),
            service_code: "DSI",
            staffName: null,
          },
          {
            id: "old",
            starts_at: new Date(2026, 9, 1, 8).toISOString(),
            service_code: "DSI",
            staffName: null,
          },
          {
            id: "far",
            starts_at: new Date(2026, 11, 30, 8).toISOString(),
            service_code: "DSI",
            staffName: null,
          },
        ],
        due: [
          { key: "plan", label: "Plan year ends", date: "2026-10-20", section: "plans" },
          { key: "late", label: "Summary 2026-Q3", date: "2026-10-01", section: "plans" },
          { key: "none", label: "No date", date: null, section: "plans" },
        ],
      },
      NOW,
    );
    assert.deepEqual(
      items.map((i) => i.key),
      ["late", "shift:s1", "shift:s2", "plan"],
    );
    assert.equal(items[1].label, "DSI (open)");
    assert.equal(items[2].label, "SLN with Sam Test");
    assert.equal(items[0].days, -5);
  });
});

describe("lastNotes", () => {
  it("drops blank notes, sorts newest first and trims long ones", () => {
    const n = (key: string, date: string, text: string): OverviewNote => ({
      key,
      date,
      kind: "shift",
      code: "SLN",
      author: null,
      text,
    });
    const out = lastNotes(
      [
        n("a", "2026-10-01", "Older"),
        n("b", "2026-10-05", "  "),
        n("c", "2026-10-04", "x".repeat(300)),
      ],
      4,
    );
    assert.deepEqual(
      out.map((o) => o.key),
      ["c", "a"],
    );
    assert.equal(out[0].text.length, 238);
    assert.ok(out[0].text.endsWith("…"));
  });
});

describe("attentionSummary", () => {
  const item = (tone: AttentionItem["tone"]): AttentionItem => ({
    key: tone,
    title: "T",
    detail: "D",
    tone,
    section: "plans",
  });
  it("is hidden with nothing to show, danger with a block, amber with only warnings", () => {
    assert.equal(attentionSummary([]), null);
    assert.deepEqual(attentionSummary([item("warn"), item("bad")]), { count: 2, tone: "danger" });
    assert.deepEqual(attentionSummary([item("warn")]), { count: 1, tone: "profile" });
  });
});

describe("comingUpWhen", () => {
  const base = { key: "k", label: "SLH with Sam Test", section: "activity" as const };
  it("names the day and time of a shift", () => {
    const startsAt = new Date(2026, 9, 8, 9, 0).toISOString();
    assert.equal(
      comingUpWhen({ ...base, date: "2026-10-08", days: 2, startsAt }),
      "Thu, Oct 8, 9:00 AM",
    );
    assert.equal(
      comingUpWhen({
        ...base,
        date: "2026-10-06",
        days: 0,
        startsAt: new Date(2026, 9, 6, 15).toISOString(),
      }),
      "Today, 3:00 PM",
    );
  });
  it("marks overdue due dates", () => {
    assert.equal(
      comingUpWhen({ ...base, date: "2026-10-01", days: -5, startsAt: null }),
      "Oct 1, 2026 (overdue)",
    );
  });
});

describe("noteHeading", () => {
  it("shows the author, date and kind of note", () => {
    const n: OverviewNote = {
      key: "a",
      date: "2026-10-04",
      kind: "shift",
      code: "SLN",
      author: "Sam Test",
      text: "x",
    };
    assert.equal(noteHeading(n), "Sam Test · Oct 4, 2026 · SLN shift note");
    assert.equal(
      noteHeading({ ...n, kind: "daily", code: null, author: null }),
      "Unknown author · Oct 4, 2026 · Daily note",
    );
  });
});
