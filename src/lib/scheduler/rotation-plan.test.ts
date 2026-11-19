import test from "node:test";
import assert from "node:assert/strict";
import {
  planRotationDrafts,
  rotationWrite,
  type PlanShift,
  type RotationDraft,
} from "./rotation-plan.ts";
import { decideCopy } from "./copy-week.ts";
import { slotOn, type RotationLine } from "./rotation.ts";
import type { Finding } from "./rules-types.ts";

const line = (o: Partial<RotationLine> = {}): RotationLine => ({
  id: "l1",
  staff_id: "maria",
  client_id: null,
  team_id: "maple",
  service_code: "RHS",
  shift_type: "day",
  cycle: [5, 2],
  cycle_start: "2026-11-01",
  weekday_mask: 0,
  start_time_local: "07:00",
  end_time_local: "15:00",
  effective_from: "2026-11-01",
  effective_until: null,
  active: true,
  ...o,
});
const FACTS = { from: "2026-11-01", to: "2026-11-14", now: "2026-11-01T06:00:00.000Z" };
const shift = (day: string, o: Partial<PlanShift> = {}): PlanShift => ({
  id: `s-${day}`,
  staff_id: "maria",
  client_id: null,
  team_id: "maple",
  service_code: "RHS",
  shift_type: "day",
  ...slotOn(line(), day),
  status: "draft",
  published: false,
  pattern_line_id: "l1",
  ...o,
});
const days = (ds: RotationDraft[]) => ds.map((d) => d.day);

test("a new line drafts every working day in the window", () => {
  const p = planRotationDrafts([{ line: line(), before: null, builtThrough: null }], [], FACTS);
  assert.equal(p.drafts.length, 10);
  assert.ok(
    p.drafts.every((d) => d.id === null && d.staff_id === "maria" && d.service_code === "RHS"),
  );
  assert.equal(p.cancels.length, 0);
});

test("the daily top-up only adds days after the last build", () => {
  const l = line();
  const p = planRotationDrafts([{ line: l, before: l, builtThrough: "2026-11-07" }], [], FACTS);
  assert.deepEqual(days(p.drafts), [
    "2026-11-08",
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
  ]);
});

test("a day whose shift was moved by hand (detached) is never built again", () => {
  const l = line();
  const moved = shift("2026-11-02", {
    id: "moved",
    pattern_line_id: null,
    ...slotOn(l, "2026-11-06"),
  });
  // Time change on the line: the attached drafts move, the moved one doesn't, Nov 2 stays empty.
  const after = line({ start_time_local: "08:00", end_time_local: "16:00" });
  const attached = ["2026-11-01", "2026-11-03", "2026-11-04", "2026-11-05"].map((d) => shift(d));
  const p = planRotationDrafts(
    [{ line: after, before: l, builtThrough: "2026-11-14" }],
    [moved, ...attached],
    FACTS,
  );
  assert.deepEqual(days(p.drafts), ["2026-11-01", "2026-11-03", "2026-11-04", "2026-11-05"]);
  assert.ok(p.drafts.every((d) => d.id && d.starts_at.endsWith("T15:00:00.000Z"))); // 8a MST
  assert.ok(!p.drafts.some((d) => d.id === "moved"));
});

test("published, started and cancelled shifts of the line are left alone", () => {
  const l = line();
  const existing = [
    shift("2026-11-02", { status: "published", published: true }),
    shift("2026-11-03", { status: "cancelled" }),
    shift("2026-11-01", { starts_at: "2026-11-01T05:00:00.000Z" }), // already started
  ];
  const p = planRotationDrafts(
    [{ line: line({ end_time_local: "17:00" }), before: l, builtThrough: "2026-11-14" }],
    existing,
    FACTS,
  );
  assert.equal(p.drafts.length, 0);
  assert.equal(p.cancels.length, 0);
});

test("a changed pattern cancels attached drafts on days it no longer works and adds the new days", () => {
  const before = line({ cycle: null, cycle_start: null, weekday_mask: 0b0000110 }); // Mon, Tue
  const after = line({ cycle: null, cycle_start: null, weekday_mask: 0b0001010 }); // Mon, Wed
  const existing = ["2026-11-02", "2026-11-03"].map((d) => shift(d));
  const p = planRotationDrafts([{ line: after, before, builtThrough: "2026-11-07" }], existing, {
    ...FACTS,
    to: "2026-11-07",
  });
  assert.deepEqual(
    p.cancels.map((c) => c.id),
    ["s-2026-11-03"],
  );
  assert.deepEqual(days(p.drafts), ["2026-11-02", "2026-11-04"]);
  assert.equal(p.drafts.find((d) => d.day === "2026-11-02")!.id, "s-2026-11-02");
});

test("ending a line cancels its attached drafts after the last day", () => {
  const before = line();
  const after = line({ effective_until: "2026-11-03" });
  const existing = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"].map((d) => shift(d));
  const p = planRotationDrafts(
    [{ line: after, before, builtThrough: "2026-11-14" }],
    existing,
    FACTS,
  );
  assert.deepEqual(
    p.cancels.map((c) => c.id),
    ["s-2026-11-04", "s-2026-11-05"],
  );
});

test("skips days where the person or the client already has an overlapping shift", () => {
  const other = shift("2026-11-02", { id: "x", pattern_line_id: null, team_id: "cedar" });
  const p = planRotationDrafts(
    [{ line: line(), before: null, builtThrough: null }],
    [other],
    FACTS,
  );
  assert.ok(!days(p.drafts).includes("2026-11-02"));
  assert.deepEqual(p.skipped, [{ lineId: "l1", day: "2026-11-02", why: "person" }]);

  const client = line({
    id: "c1",
    staff_id: null,
    team_id: null,
    client_id: "sam",
    service_code: "SLH",
  });
  const visit = shift("2026-11-03", {
    id: "v",
    staff_id: "dev",
    client_id: "sam",
    team_id: null,
    pattern_line_id: null,
  });
  const q = planRotationDrafts(
    [{ line: client, before: null, builtThrough: null }],
    [visit],
    FACTS,
  );
  assert.deepEqual(q.skipped, [{ lineId: "c1", day: "2026-11-03", why: "client" }]);
});

test("two lines for one person don't double-book each other", () => {
  const a = line();
  const b = line({ id: "l2", team_id: "cedar" });
  const p = planRotationDrafts(
    [a, b].map((l) => ({ line: l, before: null, builtThrough: null })),
    [],
    FACTS,
  );
  assert.equal(p.drafts.filter((d) => d.lineId === "l2").length, 0);
  assert.equal(p.skipped.length, 10);
});

test("days that already started are not drafted", () => {
  const p = planRotationDrafts([{ line: line(), before: null, builtThrough: null }], [], {
    ...FACTS,
    now: "2026-11-01T15:00:00.000Z",
  });
  assert.ok(!days(p.drafts).includes("2026-11-01"));
});

const f = (level: Finding["level"], rule: string, message = rule): Finding =>
  ({ level, rule, message }) as Finding;

test("a draft its person can't take lands open; one nobody can take is skipped", () => {
  const [d] = planRotationDrafts(
    [{ line: line(), before: null, builtThrough: null }],
    [],
    FACTS,
  ).drafts;
  const off = rotationWrite(d!, decideCopy([f("block", "time_off", "Maria is off")], []), null);
  assert.equal(off.kind, "insert");
  assert.deepEqual(off.kind === "insert" && off.land, {
    staff_id: null,
    status: "open",
    open_spots: 1,
  });
  const none = rotationWrite(
    d!,
    decideCopy([f("block", "auth", "No 1056")], [f("block", "auth", "No 1056")]),
    null,
  );
  assert.deepEqual(none, { kind: "skip", draft: d, message: "No 1056" });
  const ok = rotationWrite(d!, decideCopy([f("warn", "ot", "Over 40 h")], null), null);
  assert.deepEqual(ok.kind === "insert" && ok.land, {
    staff_id: "maria",
    status: "draft",
    open_spots: null,
  });
});

test("a rebuild writes only what changed, and cancels when nobody can take it", () => {
  const l = line();
  const cur = shift("2026-11-02");
  const [d] = planRotationDrafts([{ line: l, before: l, builtThrough: "2026-11-14" }], [cur], {
    ...FACTS,
    to: "2026-11-02",
  }).drafts;
  assert.deepEqual(rotationWrite(d!, { as: "draft", note: null }, cur), { kind: "none" });
  const open = rotationWrite(d!, { as: "open", message: "Time off" }, cur);
  assert.equal(open.kind, "update");
  assert.deepEqual(rotationWrite(d!, { as: "skip", message: "No 1056" }, cur), {
    kind: "cancel",
    id: cur.id,
    message: "No 1056",
  });
});

test("an open line always lands open", () => {
  const [d] = planRotationDrafts(
    [{ line: line({ staff_id: null }), before: null, builtThrough: null }],
    [],
    FACTS,
  ).drafts;
  const w = rotationWrite(d!, decideCopy([], null), null);
  assert.deepEqual(w.kind === "insert" && w.land, {
    staff_id: null,
    status: "open",
    open_spots: 1,
  });
});
