import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attentionBySection,
  clientAttention,
  codePace,
  photoStatus,
  type ReadinessInput,
} from "./readiness.ts";
import type { ClientPlan } from "./plans.ts";

const NOW = new Date(2026, 9, 6); // Oct 6, 2026, local

function plan(over: Partial<ClientPlan>): ClientPlan {
  return {
    id: "p1",
    client_id: "c1",
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    activated_on: null,
    meeting_date: null,
    status: "current",
    label: null,
    source: "manual",
    document_id: null,
    ...over,
  };
}

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    codes: ["SLN"],
    paces: [],
    fileCards: [],
    photo: { url: "photos/a.jpg", takenOn: "2025-01-01" },
    plans: [plan({})],
    strategies: null,
    summaries: [],
    restrictions: [],
    setup: { staffCount: 1, hasPin: true, guardianOk: true },
    ...over,
  };
}

describe("codePace", () => {
  it("puts the pace marker at the share of the window gone by", () => {
    const p = codePace(
      {
        service_code: "SLN",
        service_start_date: "2026-01-01",
        service_end_date: "2026-12-31",
        annual_unit_authorization: 1000,
      },
      500,
      new Date(2026, 6, 2),
    );
    assert.equal(p.left, 500);
    assert.equal(p.leftPct, 50);
    assert.ok(p.elapsedPct > 49 && p.elapsedPct < 51, String(p.elapsedPct));
  });

  it("assumes a one-year window without an end date and never goes below 0 left", () => {
    const p = codePace(
      {
        service_code: "DSI",
        service_start_date: "2026-01-01",
        service_end_date: null,
        annual_unit_authorization: 10,
      },
      12,
      NOW,
    );
    assert.equal(p.end, "2026-12-31");
    assert.equal(p.left, 0);
    assert.equal(p.usedPct, 100);
  });
});

describe("photoStatus", () => {
  it("flags a missing photo and one older than 5 years", () => {
    assert.equal(photoStatus({ url: null, takenOn: null }, NOW), "missing");
    assert.equal(photoStatus({ url: "x", takenOn: "2021-10-06" }, NOW), "old");
    assert.equal(photoStatus({ url: "x", takenOn: "2021-10-07" }, NOW), "ok");
    assert.equal(photoStatus({ url: "x", takenOn: null }, NOW), "ok");
  });
});

describe("clientAttention", () => {
  it("is empty for a client with nothing due", () => {
    assert.deepEqual(clientAttention(input(), NOW), []);
  });

  it("lists finish-setup gaps with the section that fixes them", () => {
    const items = clientAttention(
      input({ codes: [], setup: { staffCount: 0, hasPin: false, guardianOk: false } }),
      NOW,
    );
    const by = Object.fromEntries(items.map((i) => [i.detail, i.section]));
    assert.equal(by["No authorized service code"], "services");
    assert.equal(by["No team member assigned"], "team");
    assert.equal(by["Guardian not on file"], "contacts");
  });

  it("flags a missing home pin only for a client with an EVV code", () => {
    const noPin = { staffCount: 1, hasPin: false, guardianOk: true };
    const evv = clientAttention(input({ codes: ["SLN"], setup: noPin }), NOW);
    assert.deepEqual(
      evv.map((i) => [i.detail, i.section]),
      [["No home pin (address not found)", "profile"]],
    );
    assert.deepEqual(clientAttention(input({ codes: ["DSI"], setup: noPin }), NOW), []);
  });

  it("flags units running out, ahead of pace and waiting on the 1056", () => {
    const base = {
      service_start_date: "2026-01-01",
      service_end_date: "2026-12-31",
      annual_unit_authorization: 100,
    };
    const items = clientAttention(
      input({
        paces: [
          codePace({ ...base, service_code: "SLN" }, 95, NOW),
          codePace({ ...base, service_code: "DSI" }, 89, NOW),
          codePace({ ...base, service_code: "SEI", authorization_pending: true }, 0, NOW),
          codePace({ ...base, service_code: "SLH" }, 50, NOW),
        ],
      }),
      NOW,
    );
    const titles = items.map((i) => i.title);
    assert.ok(titles.includes("SLN units running out"));
    assert.ok(titles.includes("DSI ahead of pace"));
    assert.ok(titles.includes("SEI waiting on 1056"));
    assert.ok(!titles.some((t) => t.startsWith("SLH")));
  });

  it("flags documents, PCSP waiting, strategies, summaries and HRC reviews", () => {
    const items = clientAttention(
      input({
        photo: { url: "x", takenOn: "2020-01-01" },
        fileCards: [
          { key: "grievance", title: "Grievance receipt", status: "missing", dueAt: null },
          { key: "pcsp", title: "PCSP", status: "on_file", dueAt: null },
        ],
        plans: [plan({ start_date: "2025-09-01", end_date: "2026-08-31", status: "current" })],
        strategies: { published: false },
        summaries: [
          { label: "2026-Q3", dueDate: "2026-10-15" },
          { label: "2026-Q4", dueDate: "2027-01-15" },
        ],
        restrictions: [
          { title: "Locked pantry", nextReview: "2026-10-01", complete: true },
          { title: "Door alarm", nextReview: null, complete: false },
        ],
      }),
      NOW,
    );
    const keys = items.map((i) => i.key);
    assert.ok(keys.includes("photo"));
    assert.ok(keys.includes("file:grievance"));
    assert.ok(!keys.includes("file:pcsp"));
    assert.ok(keys.includes("pcsp-waiting"));
    assert.ok(keys.includes("strategies"));
    assert.ok(keys.includes("summary:2026-Q3:2026-10-15"));
    assert.ok(!keys.some((k) => k.includes("2026-Q4")));
    assert.ok(keys.includes("hrc:Locked pantry"));
    assert.ok(keys.includes("hrc:Door alarm"));
    const waiting = items.find((i) => i.key === "pcsp-waiting");
    assert.equal(waiting?.detail, "36 days since the plan year ended");
    assert.equal(waiting?.tone, "bad");
    // Worst first.
    assert.equal(items[0].tone, "bad");
    const counts = attentionBySection(items);
    assert.equal(counts.get("file"), 1);
    assert.equal(counts.get("profile"), 1);
  });

  it("counts strategies due 30 days after the current plan starts", () => {
    const items = clientAttention(
      input({ plans: [plan({ activated_on: "2026-09-20" })], strategies: { published: false } }),
      NOW,
    );
    const s = items.find((i) => i.key === "strategies");
    assert.equal(s?.detail, "Due in 14 days");
    assert.equal(s?.tone, "warn");
  });
});

describe("plan-year reminders in needs attention", () => {
  it("reminds 60 days before the plan year ends", () => {
    const items = clientAttention(input({ plans: [plan({ end_date: "2026-11-30" })] }), NOW);
    const r = items.find((i) => i.key === "plan-ending:60");
    assert.equal(r?.detail, "Ends in 55 days");
    assert.equal(r?.section, "plans");
  });
  it("turns waiting into an office follow-up from day 10", () => {
    const items = clientAttention(
      input({ plans: [plan({ start_date: "2025-09-01", end_date: "2026-09-26" })] }),
      NOW,
    );
    const w = items.find((i) => i.key === "pcsp-waiting");
    assert.equal(w?.title, "Office: follow up on the new PCSP");
    assert.equal(w?.tone, "bad");
  });
});
