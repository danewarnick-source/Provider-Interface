import test from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fake-db.ts";
import { loadActiveStaffNames } from "./staff-lookup.ts";

test("joins members to profiles in JS with two queries and no embed", async () => {
  const { db, calls } = fakeDb({
    organization_members: [{ user_id: "u1" }, { user_id: "u2" }],
    profiles: [
      { id: "u1", first_name: "Ann", last_name: "Test", full_name: null },
      { id: "u2", first_name: null, last_name: null, full_name: "  Bo Test " },
    ],
  });
  const out = await loadActiveStaffNames(db, "org");
  assert.deepEqual(out, [{ id: "u1", name: "Ann Test" }, { id: "u2", name: "Bo Test" }]);
  assert.deepEqual(calls.map((c) => c.table), ["organization_members", "profiles"]);
});

test("no members means no profile query", async () => {
  const { db, calls } = fakeDb({ organization_members: [] });
  assert.deepEqual(await loadActiveStaffNames(db, "org"), []);
  assert.equal(calls.length, 1);
});

test("a failed members query throws", async () => {
  const { db } = fakeDb({}, ["organization_members"]);
  await assert.rejects(loadActiveStaffNames(db, "org"), /organization_members failed/);
});
