import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FakeDb } from "../engine/fake-db.ts";
import { loadStateRules } from "./state.ts";

describe("state rules (Decisions 6 and 7)", () => {
  it("every agency answers from the current published version of each rule", async () => {
    const db = new FakeDb({
      tables: {
        state_rule_documents: [
          {
            id: "r1-v2",
            title: "Scope of Work",
            version: 2,
            published_at: "2026-10-01",
            archived_at: null,
          },
          {
            id: "r1-v1",
            title: "Scope of Work",
            version: 1,
            published_at: "2026-07-01",
            archived_at: "2026-10-01",
          },
          {
            id: "r2",
            title: "Unpublished rule",
            version: 1,
            published_at: null,
            archived_at: null,
          },
        ],
      },
    });
    assert.deepEqual(await loadStateRules(db.client), [
      { id: "r1-v2", title: "Scope of Work", version: 2 },
    ]);
    assert.deepEqual(db.callsTo("state_rule_documents")[0]!.filters, [
      ["not.is", "published_at", null],
      ["is", "archived_at", null],
    ]);
  });

  it("reports a failed read", async () => {
    await assert.rejects(
      loadStateRules(new FakeDb({ failing: ["state_rule_documents"] }).client),
      /Could not load the state rules/,
    );
  });
});
