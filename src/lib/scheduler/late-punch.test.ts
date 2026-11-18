import test from "node:test";
import assert from "node:assert/strict";
import {
  hasPunch,
  lateAlerts,
  lateAlertText,
  punchState,
  type PunchShift,
  type ShiftPunch,
} from "./late-punch.ts";

// Tue Nov 17 2026, 2p–10p Denver (21:00Z–05:00Z).
const shift = (o: Partial<PunchShift> = {}): PunchShift => ({
  id: "s1",
  staff_id: "nora",
  client_id: "c1",
  service_code: "sln",
  starts_at: "2026-11-17T21:00:00.000Z",
  ends_at: "2026-11-18T05:00:00.000Z",
  status: "published",
  published: true,
  parent_shift_id: null,
  ...o,
});
const at = (iso: string) => new Date(iso);
const punch = (o: Partial<ShiftPunch> = {}): ShiftPunch => ({
  scheduled_shift_id: "s1",
  staff_id: "nora",
  client_id: "c1",
  clock_in_timestamp: "2026-11-17T21:02:00.000Z",
  ...o,
});

test("not late until 10 minutes past the start", () => {
  assert.equal(punchState(shift(), [], at("2026-11-17T21:09:00.000Z")), null);
  assert.equal(punchState(shift(), [], at("2026-11-17T21:10:00.000Z")), "late");
});

test("missed once the shift has ended with no clock-in", () => {
  assert.equal(punchState(shift(), [], at("2026-11-18T05:00:00.000Z")), "missed");
});

test("a linked clock-in clears it; so does an unlinked one by the same person for the same client", () => {
  const now = at("2026-11-17T22:00:00.000Z");
  assert.equal(punchState(shift(), [punch()], now), null);
  assert.equal(punchState(shift(), [punch({ scheduled_shift_id: null })], now), null);
  assert.equal(hasPunch(shift(), [punch({ scheduled_shift_id: null, staff_id: "ava" })]), false);
  assert.equal(hasPunch(shift(), [punch({ scheduled_shift_id: "other" })]), false);
});

test("drafts, open, cancelled shifts and segments are never watched", () => {
  const now = at("2026-11-17T22:00:00.000Z");
  assert.equal(punchState(shift({ published: false }), [], now), null);
  assert.equal(punchState(shift({ staff_id: null, status: "open" }), [], now), null);
  assert.equal(punchState(shift({ status: "cancelled" }), [], now), null);
  assert.equal(punchState(shift({ parent_shift_id: "p" }), [], now), null);
});

test("lateAlerts: nudge at +10, lead at +30, each once", () => {
  const s = shift();
  assert.deepEqual(lateAlerts([s], [], new Set(), at("2026-11-17T21:05:00.000Z")), []);
  assert.deepEqual(
    lateAlerts([s], [], new Set(), at("2026-11-17T21:12:00.000Z")).map((a) => a.kind),
    ["nudge"],
  );
  assert.deepEqual(
    lateAlerts([s], [], new Set(["nudge:s1"]), at("2026-11-17T21:31:00.000Z")).map((a) => a.kind),
    ["lead"],
  );
  assert.deepEqual(
    lateAlerts([s], [], new Set(["nudge:s1", "lead:s1"]), at("2026-11-17T21:40:00.000Z")),
    [],
  );
  assert.deepEqual(lateAlerts([s], [punch()], new Set(), at("2026-11-17T21:40:00.000Z")), []);
});

test("lateAlerts: no nudge after the end, and nothing for shifts older than 12 hours", () => {
  const ended = at("2026-11-18T05:30:00.000Z");
  assert.deepEqual(
    lateAlerts([shift()], [], new Set(["lead:s1"]), ended).map((a) => a.kind),
    [],
  );
  assert.deepEqual(lateAlerts([shift()], [], new Set(), at("2026-11-18T10:00:00.000Z")), []);
});

test("alert texts carry code, day and time, never a client", () => {
  const t = lateAlertText(shift(), "nudge", at("2026-11-17T21:10:00.000Z"));
  assert.match(t.body, /10 minutes past the start of your SLN shift \(Tue, Nov 17 · 2p–10p\)/);
  const l = lateAlertText(shift(), "lead", at("2026-11-17T21:30:00.000Z"), "Nora");
  assert.match(l.body, /^Nora isn't clocked in for SLN · Tue, Nov 17 · 2p–10p, 30 minutes/);
});
