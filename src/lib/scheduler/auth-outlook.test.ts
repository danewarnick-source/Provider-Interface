import test from "node:test";
import assert from "node:assert/strict";
import {
  authOutlook,
  fmtDay,
  inDisplayUnits,
  outlookMessage,
  planYearOf,
  usageUnits,
  type OutlookInput,
} from "./auth-outlook.ts";

// Week of Nov 8–14, 2026; plan year ends Jun 30, 2027 (about 33 weeks left).
const base: OutlookInput = {
  authorized: 1000,
  usedBefore: 0,
  scheduledThisWeek: 0,
  standardWeek: 0,
  weekEnd: "2026-11-14",
  planEnd: "2027-06-30",
};

test("over the authorization is Act now", () => {
  const o = authOutlook({ ...base, usedBefore: 990, scheduledThisWeek: 20, standardWeek: 20 });
  assert.equal(o.status, "act");
  assert.equal(o.left, -10);
  assert.equal(outlookMessage(o, "h"), "Over by 10 h.");
});

test("runs out within 4 weeks is Act now; later but early is Watch", () => {
  const soon = authOutlook({ ...base, usedBefore: 900, standardWeek: 40 });
  assert.equal(soon.status, "act");
  assert.equal(soon.runsOutOn, "2026-12-02");
  const later = authOutlook({ ...base, usedBefore: 400, standardWeek: 40 });
  assert.equal(later.status, "watch");
  assert.equal(later.runsOutOn, "2027-02-27");
  assert.match(
    outlookMessage(later, "h"),
    /^Runs out about Feb 27, 2027, 18 weeks before the plan year ends\.$/,
  );
});

test("on pace when the standard week lasts to the end", () => {
  const o = authOutlook({ ...base, usedBefore: 300, scheduledThisWeek: 20, standardWeek: 20 });
  assert.equal(o.status, "ok");
  assert.equal(o.used, 320);
  assert.equal(o.left, 680);
  assert.equal(outlookMessage(o, "h"), "On pace to the end of the plan year.");
});

test("units that would go unused are Under-using", () => {
  const o = authOutlook({ ...base, usedBefore: 100, standardWeek: 10 });
  assert.equal(o.status, "under");
  assert.ok((o.unused ?? 0) > 20);
  assert.match(outlookMessage(o, "h"), /^About [\d.]+ h will go unused at this pace\.$/);
  assert.equal(authOutlook({ ...base, standardWeek: 0 }).status, "under");
});

test("plan year from the 1056 dates; the end date closes the code", () => {
  assert.deepEqual(planYearOf("2026-07-01", "2027-07-01"), {
    start: "2026-07-01",
    end: "2027-06-30",
  });
  assert.deepEqual(planYearOf("2026-09-01", null), { start: "2026-09-01", end: "2027-08-31" });
  assert.deepEqual(planYearOf(null, "2027-03-01"), { start: "2026-03-01", end: "2027-02-28" });
  assert.equal(planYearOf(null, null), null);
});

test("usage sums per-entry quarter hours; daily codes count days", () => {
  const entries = [
    { start: "2026-11-09T15:00:00Z", end: "2026-11-09T15:07:00Z" }, // 7 min → 0
    { start: "2026-11-09T16:00:00Z", end: "2026-11-09T16:08:00Z" }, // 8 min → 1
    { start: "2026-11-10T15:00:00Z", end: "2026-11-10T17:00:00Z" }, // 2 h → 8
    { start: "2026-11-10T18:00:00Z", end: null },
  ];
  assert.equal(usageUnits("DSI", entries), 9);
  assert.equal(usageUnits("HHS", entries), 2);
  assert.equal(inDisplayUnits("DSI", 9), 2.25);
  assert.equal(inDisplayUnits("HHS", 2), 2);
});

test("fmtDay shows Oct 22, 2026", () => {
  assert.equal(fmtDay("2026-10-22"), "Oct 22, 2026");
});
