import test from "node:test";
import assert from "node:assert/strict";
import { publishPlan, sameRuleShifts, sendBlocker, type PlanShift } from "./publish-plan.ts";
import type { NetChange, ShiftSnapshot } from "./shift-change.ts";
import type { Finding } from "./rules-types.ts";

const WEEK = [
  "2026-10-18",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
  "2026-10-24",
];
const sh = (id: string, o: Partial<PlanShift> = {}): PlanShift => ({
  id,
  staff_id: "ava",
  status: "published",
  published: true,
  override_reason: null,
  starts_at: "2026-10-20T13:00:00.000Z",
  ends_at: "2026-10-20T21:00:00.000Z",
  ...o,
});
const snap = (staff: string | null, status = "published"): ShiftSnapshot => ({
  staff_id: staff,
  starts_at: "2026-10-20T13:00:00.000Z",
  ends_at: "2026-10-20T21:00:00.000Z",
  status,
  published: true,
  service_code: "RHS",
  team_id: "maple",
  client_id: null,
});
const change = (
  shiftId: string,
  before: ShiftSnapshot,
  after: ShiftSnapshot,
  real = true,
): NetChange => ({
  shiftId,
  changeIds: [`c-${shiftId}`],
  affected: real
    ? [...new Set([before.staff_id, after.staff_id].filter((x): x is string => !!x))]
    : [],
  before,
  after,
  real,
});
const f = (shiftId: string, rule: string, level: Finding["level"]): Finding => ({
  shiftId,
  rule,
  level,
  message: rule,
});
const run = (
  shifts: PlanShift[],
  changes: NetChange[] = [],
  findings: Finding[] = [],
  otHours = 40,
) => publishPlan({ shifts, changes, findings, otHours, weekDays: WEEK });

test("drafts, changed shifts and open drafts make the count; untouched published shifts don't", () => {
  const p = run(
    [
      sh("pub"),
      sh("d", { published: false, status: "draft" }),
      sh("o", { staff_id: null, status: "open", published: false }),
      sh("ch"),
    ],
    [change("ch", snap("ava"), snap("ben"))],
  );
  assert.deepEqual(p.drafts, ["d"]);
  assert.deepEqual(p.openToOffer, ["o"]);
  assert.equal(p.count, 3);
  assert.deepEqual(p.checked.sort(), ["ch", "d"]);
});

test("only the people of drafts and changes get a notice; a change that cancels out tells no one", () => {
  const p = run(
    [sh("d", { published: false, status: "draft", staff_id: "cy" }), sh("ch"), sh("back")],
    [
      change("ch", snap("ava"), snap(null, "open")),
      change("back", snap("dee"), snap("dee"), false),
    ],
  );
  assert.deepEqual(p.notify.sort(), ["ava", "cy"]);
  assert.deepEqual(p.changeIds.sort(), ["c-back", "c-ch"]);
  assert.equal(p.count, 2);
});

test("findings sort into blocks, reasons and reminders; a saved reason satisfies", () => {
  const p = run(
    [
      sh("a", { published: false, status: "draft" }),
      sh("b", { published: false, status: "draft", override_reason: "Short staffed" }),
      sh("other"),
    ],
    [],
    [
      f("a", "staff_double_booked", "block"),
      f("a", "on_time_off", "reason"),
      f("b", "on_time_off", "reason"),
      f("a", "cpr", "warn"),
      f("other", "x", "block"),
    ],
  );
  assert.deepEqual(
    p.blocks.map((l) => l.shiftId),
    ["a"],
  );
  assert.deepEqual(
    p.needReason.map((l) => l.shiftId),
    ["a"],
  );
  assert.deepEqual(
    p.reminders.map((l) => `${l.shiftId}:${l.rule}`),
    ["b:on_time_off", "a:cpr"],
  );
});

test("over the overtime threshold, from the week's live staffed shifts", () => {
  const long = (id: string, day: number) =>
    sh(id, {
      starts_at: `2026-10-${day}T13:00:00.000Z`,
      ends_at: `2026-10-${day + 1}T01:00:00.000Z`,
    });
  const p = run([
    long("1", 18),
    long("2", 19),
    long("3", 20),
    long("4", 21),
    sh("x", { status: "cancelled", staff_id: "ben" }),
  ]);
  assert.deepEqual(p.overtime, [{ staffId: "ava", hours: 48 }]);
});

test("Send is disabled while a block or an empty reason remains, or nothing is new", () => {
  const blocked = run(
    [sh("a", { published: false, status: "draft" })],
    [],
    [f("a", "staff_double_booked", "block")],
  );
  assert.equal(sendBlocker(blocked, {}), "Fix the block first.");
  const reason = run(
    [
      sh("a", { published: false, status: "draft" }),
      sh("b", { published: false, status: "draft" }),
    ],
    [],
    [f("a", "on_time_off", "reason"), f("b", "on_time_off", "reason")],
  );
  assert.equal(sendBlocker(reason, { a: "Covering" }), "Add a reason for 1 shift first.");
  assert.equal(sendBlocker(reason, { a: "Covering", b: "Covering" }), null);
  assert.deepEqual(sameRuleShifts(reason, reason.needReason[0]!), ["a", "b"]);
  assert.equal(sendBlocker(run([sh("pub")]), {}), "Nothing new to send.");
});
