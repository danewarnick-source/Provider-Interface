import test from "node:test";
import assert from "node:assert/strict";
import { fakeDb } from "./fake-db.ts";
import { notify } from "./notify.ts";

const row = { organization_id: "o", type: "swap_request", title: "t", body: "b" };

test("returns true and inserts when the rows save", async () => {
  const { db, calls } = fakeDb({ notifications: null });
  assert.equal(await notify(db, row), true);
  assert.deepEqual(calls.find((c) => c.op === "insert")?.payload, [row]);
});

test("logs and returns false when the insert fails instead of swallowing it", async () => {
  const { db } = fakeDb({}, ["notifications"]);
  const logged: string[] = [];
  const orig = console.error;
  console.error = (m: string) => logged.push(m);
  try {
    assert.equal(await notify(db, row), false);
  } finally {
    console.error = orig;
  }
  assert.equal(logged.length, 1);
  assert.match(logged[0], /swap_request/);
  assert.doesNotMatch(logged[0], /"b"/);
});

test("an empty list is a no-op", async () => {
  const { db, calls } = fakeDb({});
  assert.equal(await notify(db, []), true);
  assert.equal(calls.length, 0);
});
