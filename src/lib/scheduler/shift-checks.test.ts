import test from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fake-db.ts";
import { assertShiftAllowed, collectShiftFailures } from "./shift-checks.ts";

const ORG = "00000000-0000-0000-0000-000000000001";
const base = {
  organization_id: ORG,
  staff_id: "staff-1",
  client_id: "client-1",
  code: "SLH",
  starts_at: "2026-10-14T15:00:00Z",
};
const names = {
  clients: { first_name: "Test", last_name: "Client" },
  profiles: { first_name: "Test", last_name: "Staff", full_name: null },
};

test("passes when authorized, assigned the code, and not off", async () => {
  const { db } = fakeDb({
    ...names,
    client_billing_codes: [{ id: "a", service_end_date: null }],
    staff_assignments: { id: "x", service_codes: ["SLH"] },
    time_off_requests: [],
  });
  await assertShiftAllowed(db, base);
});

test("refuses a team member on the client's do-not-schedule list, with the reason", async () => {
  const { db } = fakeDb({
    ...names,
    client_billing_codes: [{ id: "a", service_end_date: null }],
    "rpc:active_client_staff_exclusions": [
      { client_id: "client-1", staff_user_id: "staff-1", reason: "Family request" },
    ],
    staff_assignments: { id: "x", service_codes: ["SLH"] },
    time_off_requests: [],
  });
  await assert.rejects(assertShiftAllowed(db, base), /do-not-schedule list: Family request/);
});

test("refuses a code the client is not authorized for", async () => {
  const { db } = fakeDb({ ...names, client_billing_codes: [], staff_assignments: null, time_off_requests: [] });
  await assert.rejects(assertShiftAllowed(db, base), /isn't authorized for SLH/);
});

test("refuses an ended authorization", async () => {
  const { db } = fakeDb({
    ...names,
    client_billing_codes: [{ id: "a", service_end_date: "2020-01-01" }],
    staff_assignments: { id: "x", service_codes: ["SLH"] },
    time_off_requests: [],
  });
  await assert.rejects(assertShiftAllowed(db, base), /isn't authorized for SLH/);
});

test("refuses staff who are not on the client's team", async () => {
  const { db } = fakeDb({
    ...names,
    client_billing_codes: [{ id: "a", service_end_date: null }],
    staff_assignments: null,
    time_off_requests: [],
  });
  await assert.rejects(assertShiftAllowed(db, base), /isn't authorized to work with/);
});

test("refuses staff assigned a different code", async () => {
  const { db } = fakeDb({
    ...names,
    client_billing_codes: [{ id: "a", service_end_date: null }],
    staff_assignments: { id: "x", service_codes: ["COM"] },
    time_off_requests: [],
  });
  await assert.rejects(assertShiftAllowed(db, base), /isn't assigned SLH/);
});

test("refuses staff on approved time off", async () => {
  const { db } = fakeDb({
    ...names,
    client_billing_codes: [{ id: "a", service_end_date: null }],
    staff_assignments: { id: "x", service_codes: ["SLH"] },
    time_off_requests: [{ id: "t" }],
  });
  await assert.rejects(assertShiftAllowed(db, base), /is off that day/);
});

test("an open shift (no staff) only needs the client authorization", async () => {
  const { db } = fakeDb({ client_billing_codes: [{ id: "a", service_end_date: null }] });
  await assertShiftAllowed(db, { ...base, staff_id: null });
});

test("collectShiftFailures reports every failing shift and passes the rest", async () => {
  const { db } = fakeDb({
    ...names,
    client_billing_codes: [{ id: "a", service_end_date: null }],
    staff_assignments: { id: "x", service_codes: ["SLH"] },
    time_off_requests: [],
  });
  const failures = await collectShiftFailures(db, [
    { ...base, id: "ok" },
    { ...base, id: "bad", code: "COM" },
  ]);
  assert.deepEqual(failures.map((f) => f.shift_id), ["bad"]);
  assert.match(failures[0].reason, /isn't assigned COM/);
});
