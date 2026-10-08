import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvidenceItemRow } from "../evidence/types.ts";
import {
  evidenceChip,
  sendStateText,
  sentLine,
  strategiesApprovedFor,
  strategyAttention,
  strategyChip,
  strategyFileFact,
  strategySendState,
  type StrategySendInput,
} from "./strategy-sends.ts";

const plan = { id: "p2", activated_on: "2026-09-01" };

function input(over: Partial<StrategySendInput> = {}): StrategySendInput {
  return {
    needed: true,
    plan,
    approved: true,
    sends: [],
    legacyFile: null,
    today: "2026-09-10",
    ...over,
  };
}

describe("support strategies send rule", () => {
  it("is not needed when the client's codes need no strategy", () => {
    assert.deepEqual(strategySendState(input({ needed: false })), { kind: "not_needed" });
    assert.equal(strategyAttention({ kind: "not_needed" }), null);
  });

  it("asks for the activation date (or the PCSP) before anything else", () => {
    const s = strategySendState(input({ plan: { id: "p2", activated_on: null } }));
    assert.deepEqual(s, { kind: "no_activation", hasPlan: true });
    assert.equal(sendStateText(s), "Add the PCSP activation date");
    assert.equal(strategyAttention(s)?.detail, "Add the PCSP activation date");
    const none = strategySendState(input({ plan: null }));
    assert.equal(sendStateText(none), "Upload the PCSP first");
    assert.equal(strategyAttention(none), null);
  });

  it("is due 30 days after activation, reminded from day 25, overdue after day 30", () => {
    const early = strategySendState(input({ today: "2026-09-25" }));
    assert.deepEqual(early, {
      kind: "not_sent",
      dueOn: "2026-10-01",
      dueSoon: false,
      overdue: false,
    });
    assert.equal(strategyAttention(early), null);
    const soon = strategySendState(input({ today: "2026-09-26" }));
    assert.equal(soon.kind === "not_sent" && soon.dueSoon, true);
    assert.equal(
      strategyAttention(soon)?.title,
      "Support strategies not sent to the support coordinator — due Oct 1, 2026",
    );
    const due = strategySendState(input({ today: "2026-10-01" }));
    assert.equal(due.kind === "not_sent" && !due.overdue && due.dueSoon, true);
    const late = strategySendState(input({ today: "2026-10-02" }));
    assert.equal(late.kind === "not_sent" && late.overdue, true);
    assert.equal(strategyAttention(late)?.overdue, true);
  });

  it("needs approval first", () => {
    const s = strategySendState(input({ approved: false, today: "2026-10-05" }));
    assert.equal(s.kind, "not_approved");
    assert.equal(strategyAttention(s)?.detail, "Approve them, then mark as sent");
  });

  it("is sent once this plan has a send; late when sent after the due date", () => {
    const send = {
      id: "s1",
      planId: "p2",
      sentOn: "2026-10-08",
      sentTo: "Angela Duty",
      by: "Dane Warnick",
    };
    const s = strategySendState(input({ sends: [send] }));
    assert.equal(s.kind, "sent");
    assert.equal(s.kind === "sent" && s.late, true);
    if (s.kind === "sent") {
      assert.equal(sentLine(s), "Sent to Angela Duty · Oct 8, 2026 · Dane Warnick");
      assert.equal(sendStateText(s), "Sent to Angela Duty · Oct 8, 2026 · Dane Warnick · late");
    }
    assert.deepEqual(strategyFileFact(s), { onFile: true, dueOn: null });
    assert.equal(strategyAttention(s), null);
  });

  it("starts over with a new plan year: last plan's send stays history", () => {
    const old = { id: "s0", planId: "p1", sentOn: "2025-09-20", sentTo: null, by: null };
    const legacy = { on: "2025-01-01", by: null };
    const s = strategySendState(input({ sends: [old], legacyFile: legacy }));
    assert.equal(s.kind, "not_sent");
  });

  it("counts an accepted older upload when no send was ever recorded", () => {
    const s = strategySendState(
      input({ approved: false, legacyFile: { on: "2026-02-01", by: "Pat Lee" } }),
    );
    assert.equal(s.kind, "sent");
    if (s.kind === "sent")
      assert.equal(sentLine(s), "Sent to the support coordinator · Feb 1, 2026 · Pat Lee");
  });

  it("approval is for the current plan: a newer plan makes it stale", () => {
    const t = { status: "published", approved_at: "2026-05-01T00:00:00Z" };
    assert.equal(strategiesApprovedFor(t, { created_at: "2026-04-01T00:00:00Z" }), true);
    assert.equal(strategiesApprovedFor(t, { created_at: "2026-09-01T00:00:00Z" }), false);
    assert.equal(strategiesApprovedFor({ status: "draft", approved_at: null }, null), false);
  });

  it("gives the Evidence grid chip from the same rule", () => {
    const sent = strategySendState(input({ legacyFile: { on: "2026-02-01", by: null } }));
    assert.equal(strategyChip(sent, "i1", "2026-09-10").kind, "complete");
    const waiting = strategySendState(input());
    assert.deepEqual(strategyChip(waiting, "i1", "2026-09-10"), {
      kind: "due",
      label: "Due in 21d",
      itemId: "i1",
    });
    const late = strategySendState(input({ today: "2026-10-09" }));
    assert.equal(strategyChip(late, "i1", "2026-10-09").kind, "missing");
    assert.equal(strategyChip({ kind: "not_needed" }, "i1", "2026-10-09").kind, "na");
  });

  it("uses the rule only for the client Support Strategies item, and keeps a skip", () => {
    const base = {
      id: "i1",
      subject_type: "client",
      subject_id: "c1",
      requirement_key: "support_strategies",
      evidence_type: "upload",
      sent_to_staff: false,
      first_due_on: null,
      next_due_on: null,
      expires_on: null,
    } as unknown as EvidenceItemRow;
    const states = { c1: { kind: "not_needed" as const } };
    const today = "2026-09-10";
    assert.equal(evidenceChip({ item: base, file: null, today }, states).kind, "na");
    const skipped = { ...base, opted_out_at: "2026-09-01T00:00:00Z" };
    assert.equal(evidenceChip({ item: skipped, file: null, today }, states).kind, "skipped");
    const other = { ...base, requirement_key: "client_pcsp" };
    assert.equal(evidenceChip({ item: other, file: null, today }, states).kind, "add");
  });
});
