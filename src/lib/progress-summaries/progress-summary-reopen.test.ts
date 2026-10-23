import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FINALIZE_COLUMNS,
  canReopenSummary,
  readReopenHistory,
  reopenEventLine,
  reopenPatch,
} from "./progress-summary-reopen.ts";

const finalized = {
  status: "finalized",
  final_content: "FINAL TEXT",
  finalized_at: "2027-01-05T17:00:00Z",
  finalized_by: "u1",
  finalized_by_name: "Ann Admin",
  ai_review_attested_at: "2027-01-05T17:00:00Z",
  ai_review_attested_by: "u1",
  completed_at: "2027-01-06T17:00:00Z",
  completed_by: "u1",
  upi_entered_at: null,
  upi_entered_by: null,
  sc_sent_at: "2027-01-06T17:00:00Z",
  sc_sent_by: "u1",
};
const who = { by: "u2", byName: "Bo Boss", at: "2027-01-08T18:00:00Z" };

describe("reopenPatch", () => {
  it("clears every finalize / attestation column and returns to in_review", () => {
    const p = reopenPatch(
      finalized,
      { editor: { general: "x" }, final_doc: { title: "Doc" } },
      who,
      " Typo ",
    );
    assert.equal(p.status, "in_review");
    for (const c of FINALIZE_COLUMNS) assert.equal(p[c], null, c);
  });
  it("keeps the finalized copy as a superseded version and records the reopen", () => {
    const p = reopenPatch(
      finalized,
      { editor: { general: "x" }, final_doc: { title: "Doc" } },
      who,
      " Typo ",
    );
    const ds = p.draft_source as Record<string, unknown>;
    assert.deepEqual(ds.editor, { general: "x" }, "the editor stays");
    assert.equal(ds.final_doc, undefined, "the live final doc is withdrawn");
    const [v] = ds.versions as Array<Record<string, unknown>>;
    assert.equal((v.columns as Record<string, unknown>).final_content, "FINAL TEXT");
    assert.deepEqual(v.finalDoc, { title: "Doc" });
    assert.equal(v.supersededBy, "u2");
    const [e] = readReopenHistory(ds);
    assert.equal(e.reason, "Typo");
    assert.equal(e.finalizedAt, finalized.finalized_at);
    assert.deepEqual(e.withdrew, { upiEnteredAt: null, scSentAt: finalized.sc_sent_at });
  });
  it("appends to earlier history; refuses a summary that is not finalized", () => {
    const first = reopenPatch(finalized, {}, who, null).draft_source as Record<string, unknown>;
    const second = reopenPatch(finalized, first, { ...who, at: "2027-01-09T18:00:00Z" }, null)
      .draft_source as Record<string, unknown>;
    assert.equal((second.versions as unknown[]).length, 2);
    assert.deepEqual(
      readReopenHistory(second).map((e) => e.at),
      ["2027-01-09T18:00:00Z", "2027-01-08T18:00:00Z"],
    );
    assert.throws(() => reopenPatch({ status: "in_review" }, {}, who, null), /not finalized/);
    assert.equal(canReopenSummary({ status: "in_review", completed_at: "x" }), true);
  });
  it("describes the reopen and the withdrawn attestation", () => {
    const [e] = readReopenHistory(reopenPatch(finalized, {}, who, "Typo").draft_source);
    assert.equal(
      reopenEventLine(e),
      "Reopened Jan 8, 2027 by Bo Boss — Typo. Sent to Support Coordinator attestation withdrawn.",
    );
    assert.deepEqual(readReopenHistory(null), []);
  });
});
