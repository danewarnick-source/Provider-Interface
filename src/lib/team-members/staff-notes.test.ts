import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  STAFF_NOTE_KIND_LABEL,
  STAFF_NOTE_KINDS,
  checkNoteBody,
  isStaffNoteKind,
  sortNotesNewestFirst,
} from "./staff-notes.ts";

describe("staff notes", () => {
  it("kinds match the DB check", () => {
    assert.deepEqual([...STAFF_NOTE_KINDS], ["note", "praise", "concern"]);
    assert.deepEqual(Object.values(STAFF_NOTE_KIND_LABEL), ["Note", "Praise", "Concern"]);
    assert.equal(isStaffNoteKind("praise"), true);
    assert.equal(isStaffNoteKind("warning"), false);
  });

  it("body is trimmed and 1–5000 characters", () => {
    assert.deepEqual(checkNoteBody("  hi "), { ok: true, body: "hi" });
    assert.equal(checkNoteBody("   ").ok, false);
    assert.equal(checkNoteBody("x".repeat(5000)).ok, true);
    assert.equal(checkNoteBody("x".repeat(5001)).ok, false);
  });

  it("sorts newest first", () => {
    const rows = [
      { id: "a", createdAt: "2026-09-01T00:00:00Z" },
      { id: "b", createdAt: "2026-09-03T00:00:00Z" },
      { id: "c", createdAt: "2026-09-02T00:00:00Z" },
    ];
    assert.deepEqual(
      sortNotesNewestFirst(rows).map((r) => r.id),
      ["b", "c", "a"],
    );
  });

  it("server file offers only list and add — no edit, no delete", () => {
    const src = readFileSync(new URL("./notes.functions.ts", import.meta.url), "utf8");
    assert.match(src, /export const listStaffNotes/);
    assert.match(src, /export const addStaffNote/);
    assert.doesNotMatch(src, /\.update\(|\.delete\(|\.upsert\(/);
    assert.match(src, /"staff_hiring", "view"/);
    assert.match(src, /"staff_hiring", "edit"/);
  });

  it("migration: append-only RLS on staff_notes", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260928163833_team_members_separation_and_notes.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(sql, /enable row level security/);
    assert.match(
      sql,
      /access_has_category\(organization_id, auth\.uid\(\), 'staff_hiring', 'view'\)/,
    );
    assert.match(sql, /author_id = auth\.uid\(\)/);
    assert.match(sql, /revoke update, delete on public\.staff_notes from authenticated/);
    assert.doesNotMatch(sql, /for (update|delete)/i);
    assert.doesNotMatch(sql, /using \(true\)/i);
  });
});
