// B1 done-when: saving a shift for a team member on the client's
// do-not-schedule list is refused, and the reason shows. Runs the same guard
// saveShift, publishWeek, claims, repeats and clock-in call.
import test from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fake-db.ts";
import {
  checkShiftRows,
  guardShiftRows,
  refusalsByShift,
  ShiftRefusedError,
} from "./shift-guard.server.ts";

const ORG = "00000000-0000-0000-0000-000000000001";
const row = {
  id: "shift-1",
  staff_id: "staff-1",
  client_id: "client-1",
  service_code: "SLH",
  starts_at: "2026-10-14T15:00:00Z",
  ends_at: "2026-10-14T17:00:00Z",
  status: "draft",
};
const facts = (over: Record<string, unknown> = {}) => ({
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
      authorization_approved_on: "2026-01-01",
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
  time_off_requests: [],
  evidence_items: [],
  scheduled_shifts: [],
  org_shift_behavior_settings: { rule_settings: {}, ot_threshold_hours: 40 },
  ...over,
});

test("a team member on the do-not-schedule list is refused, with the reason", async () => {
  const { db } = fakeDb(
    facts({
      "rpc:active_client_staff_exclusions": [
        { client_id: "client-1", staff_user_id: "staff-1", reason: "Family request" },
      ],
    }),
  );
  await assert.rejects(
    guardShiftRows(db, ORG, [row]),
    (e: unknown) =>
      e instanceof ShiftRefusedError &&
      /Test is on Test's do-not-schedule list: Family request/.test(e.message),
  );
});

test("the same shift saves when nothing blocks; card reminders come back as warnings", async () => {
  const { db } = fakeDb(facts());
  const warnings = await guardShiftRows(db, ORG, [row]);
  assert.ok(warnings.some((w) => /General trainings/.test(w)));
});

test("a code the team member isn't assigned for this client warns by default, and refuses when Not on the team is Block", async () => {
  const notAssigned = { staff_assignments: [{ client_id: "client-1", staff_id: "staff-1", service_codes: ["DSI"] }] };
  const warnings = await guardShiftRows(fakeDb(facts(notAssigned)).db, ORG, [row]);
  assert.ok(warnings.some((w) => /isn't assigned SLH for Test/.test(w)));
  const blocked = fakeDb(facts({ ...notAssigned, org_shift_behavior_settings: { rule_settings: { team: "block" }, ot_threshold_hours: 40 } }));
  await assert.rejects(guardShiftRows(blocked.db, ORG, [row]), /isn't assigned SLH for Test/);
});

test("no authorization for the code is refused, whatever the agency setting", async () => {
  const { db } = fakeDb(
    facts({
      "rpc:client_authorizations_for_rules": [],
      org_shift_behavior_settings: {
        rule_settings: { no_authorization: "warn" },
        ot_threshold_hours: 40,
      },
    }),
  );
  await assert.rejects(guardShiftRows(db, ORG, [row]), /has no SLH authorization/);
});

test("an ended authorization (end date on or before the shift day) is refused", async () => {
  const { db } = fakeDb(
    facts({
      "rpc:client_authorizations_for_rules": [
        {
          client_id: "client-1",
          service_code: "SLH",
          service_start_date: "2026-01-01",
          service_end_date: "2026-10-14",
          authorization_approved_on: null,
          worksheet_weekly_hours: null,
          ratio: null,
        },
      ],
    }),
  );
  await assert.rejects(guardShiftRows(db, ORG, [row]), /has no SLH authorization on 2026-10-14/);
});

test("publish gets one refusal line per blocked shift", async () => {
  const { db } = fakeDb(
    facts({
      "rpc:active_client_staff_exclusions": [
        { client_id: "client-1", staff_user_id: "staff-1", reason: "" },
      ],
    }),
  );
  const { verdict } = await checkShiftRows(db, ORG, [row]);
  assert.equal(refusalsByShift(verdict).get("shift-1"), "Test is on Test's do-not-schedule list");
});
