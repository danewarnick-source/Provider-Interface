import test from "node:test";
import assert from "node:assert/strict";
import { decideCopy, planCopyWeek, type CopySource } from "./copy-week.ts";
import type { Finding } from "./rules-types.ts";

// Week of Sun Oct 18, 2026 → Sun Oct 25 (MDT) and Nov 1 (MST: DST ends Nov 1).
const src = (o: Partial<CopySource> = {}): CopySource => ({
  id: "s1",
  staff_id: "theo",
  client_id: null,
  team_id: "maple",
  service_code: "RHS",
  starts_at: "2026-10-20T13:00:00.000Z", // Tue 7a
  ends_at: "2026-10-20T21:00:00.000Z", // Tue 3p
  status: "published",
  shift_type: "hourly",
  notes: null,
  open_spots: null,
  parent_shift_id: null,
  ...o,
});
const plan = (source: CopySource[], existing: CopySource[] = [], scope = "all", toWeek = "2026-10-25") =>
  planCopyWeek({ source, existing, fromWeek: "2026-10-18", toWeek, scope, placeOf: (s) => s.team_id ?? "community" });

test("copies land on the same weekday and wall clock, across DST", () => {
  const { copies } = plan([src()]);
  assert.equal(copies[0]!.starts_at, "2026-10-27T13:00:00.000Z");
  const nov = plan([src()], [], "all", "2026-11-01").copies[0]!;
  assert.equal(nov.starts_at, "2026-11-03T14:00:00.000Z"); // still 7a, now MST
  assert.equal(nov.sourceId, "s1");
});

test("cancelled shifts and other weeks are not copied", () => {
  const { copies } = plan([src({ status: "cancelled" }), src({ id: "s2", starts_at: "2026-10-26T13:00:00Z", ends_at: "2026-10-26T21:00:00Z" })]);
  assert.equal(copies.length, 0);
});

test("never overwrites: same person or same client overlapping, or the same shift", () => {
  const theo = src({ id: "t", starts_at: "2026-10-27T15:00:00Z", ends_at: "2026-10-27T23:00:00Z", team_id: "cedar" });
  assert.deepEqual(plan([src()], [theo]).skipped, [{ sourceId: "s1", why: "person" }]);
  const client = src({ client_id: "riley", team_id: null, service_code: "COM" });
  const other = { ...client, id: "x", staff_id: "ava", starts_at: "2026-10-27T14:00:00Z", ends_at: "2026-10-27T22:00:00Z" };
  assert.deepEqual(plan([client], [other]).skipped, [{ sourceId: "s1", why: "client" }]);
  const open = src({ staff_id: null, status: "open" });
  const already = { ...open, id: "y", starts_at: "2026-10-27T13:00:00.000Z", ends_at: "2026-10-27T21:00:00.000Z" };
  assert.deepEqual(plan([open], [already]).skipped, [{ sourceId: "s1", why: "duplicate" }]);
});

test("back-to-back and cancelled target shifts don't block a copy", () => {
  const after = src({ id: "t", starts_at: "2026-10-27T21:00:00Z", ends_at: "2026-10-28T05:00:00Z" });
  const gone = src({ id: "g", status: "cancelled", starts_at: "2026-10-27T13:00:00Z", ends_at: "2026-10-27T21:00:00Z" });
  assert.equal(plan([src()], [after, gone]).copies.length, 1);
});

test("scope: one home or community only", () => {
  const community = src({ id: "c", team_id: null, client_id: "riley", service_code: "COM" });
  assert.deepEqual(plan([src(), community], [], "maple").copies.map((c) => c.sourceId), ["s1"]);
  assert.deepEqual(plan([src(), community], [], "community").copies.map((c) => c.sourceId), ["c"]);
});

test("a segment copies only with its parent", () => {
  const seg = src({ id: "seg", parent_shift_id: "s1", client_id: "riley", service_code: "DSI" });
  const both = plan([seg, src()]);
  assert.deepEqual(both.copies.map((c) => [c.sourceId, c.parentSourceId]), [["s1", null], ["seg", "s1"]]);
  assert.deepEqual(plan([seg]).skipped, [{ sourceId: "seg", why: "parent" }]);
});

const f = (rule: string, level: Finding["level"], message = rule): Finding => ({ rule, level, message });

test("decideCopy: clean → draft; the person's block → open; a block with no one on it → skip", () => {
  assert.deepEqual(decideCopy([f("rest", "warn", "Short rest")], []), { as: "draft", note: "Short rest" });
  assert.deepEqual(decideCopy([f("on_time_off", "reason", "Theo is off Oct 25–26")], []), {
    as: "open",
    message: "Theo is off Oct 25–26",
  });
  assert.deepEqual(decideCopy([f("on_time_off", "block")], [f("no_authorization", "block", "No auth")]), {
    as: "skip",
    message: "No auth",
  });
});

test("decideCopy: a client rule needing a reason copies as a draft and asks at Send", () => {
  const auth = f("over_authorized_units", "reason", "Riley would pass the 1056 by 2 h");
  assert.deepEqual(decideCopy([auth], [auth]), {
    as: "draft",
    note: "Needs a reason at Send: Riley would pass the 1056 by 2 h",
  });
  assert.deepEqual(decideCopy([f("no_authorization", "block", "No auth")], null), { as: "skip", message: "No auth" });
});
