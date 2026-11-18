import test from "node:test";
import assert from "node:assert/strict";
import {
  changeCard,
  changeOf,
  collapseChanges,
  noticeFor,
  snapshotOf,
  type ChangeRow,
  type ShiftSnapshot,
} from "./shift-change.ts";

// Thu Oct 22, 2026, 3p–11p Denver (MDT, UTC-6).
const snap = (o: Partial<ShiftSnapshot> = {}): ShiftSnapshot => ({
  staff_id: "ava",
  starts_at: "2026-10-22T21:00:00.000Z",
  ends_at: "2026-10-23T05:00:00.000Z",
  status: "published",
  published: true,
  service_code: "RHS",
  team_id: "maple",
  client_id: null,
  ...o,
});
const row = (id: string, at: string, before: ShiftSnapshot, after: ShiftSnapshot, shift = "s1"): ChangeRow => ({
  id,
  shift_id: shift,
  affected_staff_ids: [],
  before,
  after,
  changed_at: at,
});

test("a draft never published makes no change", () => {
  assert.equal(changeOf(snap({ published: false, status: "draft" }), snap({ published: false, staff_id: "ben" })), null);
});

test("a published shift's new time affects its person", () => {
  assert.deepEqual(changeOf(snap(), snap({ starts_at: "2026-10-22T22:00:00Z" })), { affected: ["ava"] });
});

test("reassigning affects the old and the new person; making it open, the old one", () => {
  assert.deepEqual(changeOf(snap(), snap({ staff_id: "ben" })), { affected: ["ava", "ben"] });
  assert.deepEqual(changeOf(snap(), snap({ staff_id: null, status: "open" })), { affected: ["ava"] });
});

test("cancel and restore are changes; a note or a reason alone is not", () => {
  assert.deepEqual(changeOf(snap(), snap({ status: "cancelled" })), { affected: ["ava"] });
  assert.deepEqual(changeOf(snap({ status: "cancelled" }), snap()), { affected: ["ava"] });
  assert.equal(changeOf(snap(), snap({ service_code: "RHS" })), null);
});

test("snapshotOf keeps only the record's fields", () => {
  const s = snapshotOf({ ...snap(), notes: "x" } as never);
  assert.deepEqual(Object.keys(s).sort(), Object.keys(snap()).sort());
});

test("collapse: first before, last after; moved and moved back tells no one", () => {
  const moved = snap({ starts_at: "2026-10-22T22:00:00Z" });
  const [net] = collapseChanges([row("b", "2026-10-20T02:00:00Z", moved, snap()), row("a", "2026-10-20T01:00:00Z", snap(), moved)]);
  assert.equal(net!.real, false);
  assert.deepEqual(net!.changeIds, ["a", "b"]);
  assert.deepEqual(net!.affected, []);
  const [two] = collapseChanges([
    row("a", "2026-10-20T01:00:00Z", snap(), snap({ staff_id: "ben" })),
    row("b", "2026-10-20T02:00:00Z", snap({ staff_id: "ben" }), snap({ staff_id: "cy" })),
  ]);
  assert.equal(two!.real, true);
  assert.deepEqual(two!.affected, ["ava", "cy"]);
});

test("the phone card reads as the plan's example", () => {
  const c = { before: snap(), after: snap({ starts_at: "2026-10-22T22:00:00.000Z" }) };
  assert.deepEqual(changeCard(c, "ava", "Maple House"), {
    kind: "changed",
    title: "Your Thu shift changed",
    detail: "3p–11p → 4p–11p at Maple House",
  });
});

test("cards for cancelled, removed, new and moved-day shifts", () => {
  assert.equal(changeCard({ before: snap(), after: snap({ status: "cancelled" }) }, "ava").kind, "cancelled");
  assert.equal(changeCard({ before: snap(), after: snap({ staff_id: "ben" }) }, "ava").title, "Removed from your schedule");
  assert.equal(changeCard({ before: snap(), after: snap({ staff_id: "ben" }) }, "ben").title, "New shift for you");
  assert.equal(changeCard({ before: snap({ status: "cancelled" }), after: snap() }, "ava").title, "Back on your schedule");
  const fri = changeCard(
    { before: snap(), after: snap({ starts_at: "2026-10-23T21:00:00.000Z", ends_at: "2026-10-24T05:00:00.000Z" }) },
    "ava",
  );
  assert.equal(fri.detail, "Thu 3p–11p → Fri 3p–11p");
});

test("one notice per person; no client in it", () => {
  const one = noticeFor("ava", [{ before: snap(), after: snap({ status: "cancelled" }) }], 0, "Oct 18");
  assert.equal(one.type, "shift_changed");
  assert.equal(one.body, "RHS Thu 3p–11p");
  assert.equal(noticeFor("ava", [], 3, "Oct 18").body, "You have 3 new shifts for the week of Oct 18.");
  assert.match(noticeFor("ava", [{ before: snap(), after: snap() }], 2, "Oct 18").body, /^3 changes to your week of Oct 18/);
});
