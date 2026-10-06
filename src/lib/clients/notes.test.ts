import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLIENT_NOTE_MAX, cleanNoteBody, openNotes, shiftHours } from "./notes.ts";

describe("cleanNoteBody", () => {
  it("trims and checks length", () => {
    assert.deepEqual(cleanNoteBody("  Called the office \n"), { ok: true, value: "Called the office" });
    assert.equal(cleanNoteBody("   ").ok, false);
    assert.equal(cleanNoteBody("x".repeat(CLIENT_NOTE_MAX + 1)).ok, false);
  });
});

describe("openNotes", () => {
  it("drops archived and sorts newest first", () => {
    const r = openNotes([
      { id: "a", created_at: "2026-01-01T00:00:00Z", archived_at: null },
      { id: "b", created_at: "2026-03-01T00:00:00Z", archived_at: null },
      { id: "c", created_at: "2026-04-01T00:00:00Z", archived_at: "2026-04-02T00:00:00Z" },
    ]);
    assert.deepEqual(
      r.map((n) => n.id),
      ["b", "a"],
    );
  });
});

describe("shiftHours", () => {
  it("rounds to one decimal and is null while open or backwards", () => {
    assert.equal(shiftHours("2026-01-01T08:00:00Z", "2026-01-01T10:20:00Z"), 2.3);
    assert.equal(shiftHours("2026-01-01T08:00:00Z", null), null);
    assert.equal(shiftHours("2026-01-01T10:00:00Z", "2026-01-01T08:00:00Z"), null);
  });
});
