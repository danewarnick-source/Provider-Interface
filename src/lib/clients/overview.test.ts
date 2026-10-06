import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { comingUpItems, lastNotes, type OverviewNote } from "./overview.ts";

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
