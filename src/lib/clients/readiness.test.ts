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
import type { RestrictionRecord } from "./hrc.ts";

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

/** A rights restriction: fully signed and HRC-approved when `done`, else only answered. */
function hrr(id: string, title: string, nextReview: string | null, done: boolean): RestrictionRecord {
  const answered = {
    condition_description_text: "x",
    assessed_need_text: "x",
    positive_interventions_text: "x",
    less_intrusive_methods_text: "x",
    data_review_text: "x",
    last_review_date: "2026-09-01",
    time_limits_text: "x",
    no_harm_text: "x",
  };
  const signed = {
    consent_signer_name: "Pat",
    consent_at: "2026-10-01T00:00:00Z",
    admin_signer_name: "Alex",
    admin_signed_at: "2026-10-01T00:00:00Z",
    sc_name: "Sam",
    sc_signed_on: "2026-10-01",
    sc_method: "email",
    hrc_decision: "approved",
    hrc_decision_on: "2026-10-02",
  };
  return {
    id,
    restriction_title: title,
    next_review_date: nextReview,
    ...answered,
    ...(done ? signed : {}),
  } as unknown as RestrictionRecord;
}

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    codes: ["SLN"],
    paces: [],
    fileCards: [],
    photo: { url: "photos/a.jpg", takenOn: "2025-01-01" },
    plans: [plan({})],
    strategies: { kind: "not_needed" },
    summaries: [],
    restrictions: [],
    setup: { staffCount: 1, hasPin: true, guardianGap: null },
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
      input({
        codes: [],
        setup: { staffCount: 0, hasPin: false, guardianGap: "Guardian has no phone" },
      }),
      NOW,
    );
    const by = Object.fromEntries(items.map((i) => [i.detail, i.section]));
    assert.equal(by["No authorized service code"], "services");
    assert.equal(by["No team member assigned"], "team");
    assert.equal(by["Guardian has no phone"], "contacts");
  });

  it("flags a missing home pin only for a client with an EVV code", () => {
    const noPin = { staffCount: 1, hasPin: false, guardianGap: null };
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
        strategies: { kind: "not_approved", dueOn: "2026-10-01", dueSoon: false, overdue: true },
        summaries: [
          { label: "2026-Q3", dueDate: "2026-10-15" },
          { label: "2026-Q4", dueDate: "2027-01-15" },
        ],
        restrictions: [
          hrr("r1", "Locked pantry", "2026-10-01", true),
          hrr("r2", "Door alarm", "2026-12-01", false),
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
    assert.ok(keys.includes("hrc:r1"));
    assert.equal(items.find((i) => i.key === "hrc:r1")?.title, "HRC review: Locked pantry");
    const unsigned = items.find((i) => i.key === "hrc:r2");
    assert.equal(unsigned?.title, "Rights restriction: Door alarm");
    assert.equal(
      unsigned?.detail,
      "Waiting on: client consent, provider admin, support coordinator, human rights committee",
    );
    const waiting = items.find((i) => i.key === "pcsp-waiting");
    assert.equal(waiting?.title, "PCSP is 36 days overdue");
    assert.equal(waiting?.detail, "Upload it, or contact the support coordinator if you don't have it yet.");
    assert.equal(waiting?.tone, "bad");
    // Worst first.
    assert.equal(items[0].tone, "bad");
    const counts = attentionBySection(items);
    assert.equal(counts.get("file"), 1);
    assert.equal(counts.get("profile"), 1);
  });

  it("reminds about strategies not sent from day 25; quiet before, when sent or not needed", () => {
    const soon = clientAttention(
      input({ strategies: { kind: "not_sent", dueOn: "2026-10-10", dueSoon: true, overdue: false } }),
      NOW,
    );
    const s = soon.find((i) => i.key === "strategies");
    assert.equal(s?.title, "Support strategies not sent to the support coordinator — due Oct 10, 2026");
    assert.equal(s?.detail, "Mark them as sent");
    assert.equal(s?.tone, "warn");
    const early = { kind: "not_sent", dueOn: "2026-10-30", dueSoon: false, overdue: false } as const;
    assert.ok(!clientAttention(input({ strategies: early }), NOW).some((i) => i.key === "strategies"));
    const sent = { kind: "sent", sendId: "s", sentOn: "2026-10-01", sentTo: null, by: null, late: false } as const;
    assert.ok(!clientAttention(input({ strategies: sent }), NOW).some((i) => i.key === "strategies"));
    assert.ok(!clientAttention(input(), NOW).some((i) => i.key === "strategies"));
  });

  it("asks for the activation date when the plan has none", () => {
    const items = clientAttention(input({ strategies: { kind: "no_activation", hasPlan: true } }), NOW);
    assert.equal(items.find((i) => i.key === "strategies")?.detail, "Add the PCSP activation date");
  });
});
