// B1 done-when: a punch made from a scheduled shift is linked to that shift.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fakeDb } from "./fake-db.ts";
import { clockInCheck } from "./clock-in.server.ts";
import { pickShiftForClockIn } from "./staff-clock.ts";

const ORG = "00000000-0000-0000-0000-000000000001";
const NOW = new Date("2026-10-14T16:00:00Z"); // 10:00 Denver
const at = (h: number) => `2026-10-14T${String(h).padStart(2, "0")}:00:00Z`;
const shift = (id: string, from: number, to: number, status = "published") => ({
  id,
  staff_id: "staff-1",
  client_id: "client-1",
  service_code: "SLH",
  starts_at: at(from),
  ends_at: at(to),
  status,
});
const facts = (shifts: unknown[], over: Record<string, unknown> = {}) => ({
  scheduled_shifts: shifts,
  clients: [
    {
      id: "client-1",
      first_name: "Test",
      last_name: "Client",
      date_of_birth: "1990-01-01",
      has_abi: false,
    },
  ],
  "rpc:client_authorizations_for_rules": [
    {
      client_id: "client-1",
      service_code: "SLH",
      service_start_date: "2026-01-01",
      service_end_date: null,
      authorization_approved_on: null,
      worksheet_weekly_hours: null,
      ratio: null,
    },
  ],
  staff_assignments: [{ client_id: "client-1", staff_id: "staff-1", service_codes: ["SLH"] }],
  profiles: [
    {
      id: "staff-1",
      full_name: "Test Staff",
      date_of_birth: "1990-01-01",
      hire_date: "2020-01-01",
    },
  ],
  organization_members: [{ user_id: "staff-1", active: true }],
  org_shift_behavior_settings: { rule_settings: {} },
  ...over,
});
const check = (db: unknown, reason?: string) =>
  clockInCheck(db, {
    orgId: ORG,
    staffId: "staff-1",
    clientId: "client-1",
    code: "slh",
    now: NOW,
    reason,
  });

test("picks the shift under way, else the next one today, else today's first", () => {
  const a = shift("a", 14, 15),
    b = shift("b", 15, 18),
    c = shift("c", 19, 21);
  assert.equal(pickShiftForClockIn([c, a, b], NOW)?.id, "b");
  assert.equal(pickShiftForClockIn([c, a], NOW)?.id, "c");
  assert.equal(pickShiftForClockIn([a], NOW)?.id, "a");
  assert.equal(pickShiftForClockIn([], NOW), null);
});

test("a punch made from a scheduled shift is linked to that shift", async () => {
  const { db } = fakeDb(facts([shift("sched-1", 15, 18)]));
  const r = await check(db);
  assert.equal(r.scheduledShiftId, "sched-1");
  assert.equal(r.refusal, null);
});

test("an unscheduled punch has no link and still runs the rules", async () => {
  const { db } = fakeDb(facts([], { "rpc:client_authorizations_for_rules": [] }));
  const r = await check(db);
  assert.equal(r.scheduledShiftId, null);
  assert.match(r.refusal ?? "", /no SLH authorization/);
});

test("cancelled shifts are never linked", async () => {
  const { db } = fakeDb(facts([shift("gone", 15, 18, "cancelled")]));
  assert.equal((await check(db)).scheduledShiftId, null);
});

test("a Require-a-reason rule asks the staff member for a reason, and goes ahead once given", async () => {
  const over = { org_shift_behavior_settings: { rule_settings: { general_training: "reason" } } };
  const { db } = fakeDb(facts([shift("sched-1", 15, 18)], over));
  const without = await check(db);
  assert.match(without.refusal ?? "", /^Add a reason to go ahead/);
  assert.ok(without.reasonLines.some((l) => /General trainings/.test(l)));
  const withReason = await check(db, "Orientation booked Friday");
  assert.equal(withReason.refusal, null);
});

test("the punch pad saves the link and the reason on the punch", () => {
  const pad = readFileSync(new URL("../../components/evv/punch-pad.tsx", import.meta.url), "utf8");
  assert.match(pad, /scheduled_shift_id: +rules\.scheduledShiftId/);
  assert.match(pad, /override_reason: +rules\.reason/);
});
