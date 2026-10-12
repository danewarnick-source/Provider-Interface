import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  codesNeeding1056,
  expiredBadge,
  pcspDueHeadline,
  pcspSentence,
  pcspState,
  pcspWords,
} from "./pcsp-status.ts";
import { waitingDays, type ClientPlan } from "./plans.ts";

const NOW = new Date(2026, 9, 6); // Oct 6, 2026, local

function plan(over: Partial<ClientPlan>): ClientPlan {
  return {
    id: "p1",
    client_id: "c1",
    start_date: "2025-10-01",
    end_date: "2026-09-30",
    activated_on: null,
    meeting_date: null,
    status: "current",
    label: null,
    source: "manual",
    document_id: null,
    ...over,
  };
}

describe("pcspState", () => {
  it("is none with no plan year", () => {
    assert.deepEqual(pcspState([], NOW), { kind: "none" });
    const upcoming = plan({ start_date: "2026-11-01", end_date: "2027-10-31", status: "upcoming" });
    assert.equal(pcspState([upcoming], NOW).kind, "ok");
  });
  it("counts days overdue since the plan year ended with no newer plan", () => {
    assert.equal(waitingDays([plan({})], NOW), 6);
    assert.deepEqual(pcspState([plan({})], NOW), {
      kind: "overdue",
      endDate: "2026-09-30",
      days: 6,
      followUp: false,
    });
  });
  it("asks to contact the support coordinator from day 10", () => {
    assert.equal(pcspState([plan({ end_date: "2026-09-27" })], NOW).kind, "overdue");
    assert.deepEqual(pcspState([plan({ end_date: "2026-09-26" })], NOW), {
      kind: "overdue",
      endDate: "2026-09-26",
      days: 10,
      followUp: true,
    });
  });
  it("is ok once a newer plan has started", () => {
    const plans = [
      plan({ status: "past" }),
      plan({ id: "p2", start_date: "2026-10-01", end_date: "2027-09-30" }),
    ];
    assert.deepEqual(pcspState(plans, NOW), { kind: "ok", endDate: "2027-09-30", days: 359 });
  });
  it("reminds 60 and then 30 days before the plan year ends", () => {
    assert.equal(
      pcspState([plan({ start_date: "2026-01-01", end_date: "2026-12-31" })], NOW).kind,
      "ok",
    );
    assert.deepEqual(pcspState([plan({ start_date: "2026-01-01", end_date: "2026-12-01" })], NOW), {
      kind: "expiring",
      endDate: "2026-12-01",
      days: 56,
      threshold: 60,
    });
    assert.deepEqual(pcspState([plan({ start_date: "2026-01-01", end_date: "2026-11-05" })], NOW), {
      kind: "expiring",
      endDate: "2026-11-05",
      days: 30,
      threshold: 30,
    });
  });
});

describe("pcsp wording (Plans card, Needs attention, header tile, list)", () => {
  it("says when the PCSP expires, with the short date", () => {
    const w = pcspWords(
      pcspState([plan({ start_date: "2026-01-01", end_date: "2026-11-05" })], NOW),
    )!;
    assert.equal(w.headline, "PCSP expires in 30 days (Nov 5)");
    assert.equal(
      pcspSentence(w),
      "PCSP expires in 30 days (Nov 5). Schedule the PCSP meeting with the support coordinator.",
    );
    assert.equal(w.fix, "schedule");
  });
  it("says how overdue it is and what to do", () => {
    const early = pcspWords(pcspState([plan({})], NOW))!;
    assert.equal(pcspSentence(early), "PCSP is 6 days overdue. Upload the new PCSP.");
    assert.equal(early.fix, "upload");
    const late = pcspWords(pcspState([plan({ end_date: "2026-09-26" })], NOW))!;
    assert.equal(
      pcspSentence(late),
      "PCSP is 10 days overdue. Upload it, or contact the support coordinator if you don't have it yet.",
    );
    assert.equal(
      pcspWords({ kind: "overdue", endDate: null, days: 1, followUp: false })!.headline,
      "PCSP is 1 day overdue",
    );
  });
  it("says no PCSP on file, and nothing when all is well", () => {
    assert.equal(pcspWords({ kind: "none" })!.headline, "No PCSP on file");
    assert.equal(pcspWords({ kind: "ok", endDate: "2027-09-30", days: 300 }), null);
  });
  it("the list's headline matches the card's", () => {
    assert.equal(pcspDueHeadline(-6, "2026-09-30"), "PCSP is 6 days overdue");
    assert.equal(pcspDueHeadline(30, "2026-11-05"), "PCSP expires in 30 days (Nov 5)");
    assert.equal(pcspDueHeadline(0, "2026-10-06"), "PCSP expires today (Oct 6)");
  });
  it("labels an ended plan year by days since it expired", () => {
    assert.equal(expiredBadge(6), "Expired 6 days ago");
    assert.equal(expiredBadge(1), "Expired 1 day ago");
  });
});

describe("codesNeeding1056", () => {
  it("lists the plan's codes with no authorization covering today", () => {
    const auths = [
      { service_code: "DSI", service_start_date: "2026-01-01", service_end_date: "2026-12-31" },
      { service_code: "SEI", service_start_date: "2026-11-01", service_end_date: "2027-10-31" },
      { service_code: "HHS", service_start_date: "2025-01-01", service_end_date: "2026-09-30" },
    ];
    assert.deepEqual(codesNeeding1056(["sei", "DSI", "HHS", "SLN", "DSI"], auths, "2026-10-06"), [
      "HHS",
      "SEI",
      "SLN",
    ]);
    assert.deepEqual(codesNeeding1056(["DSI"], auths, "2026-10-06"), []);
  });
});
