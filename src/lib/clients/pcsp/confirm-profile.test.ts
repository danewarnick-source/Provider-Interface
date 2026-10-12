import { test } from "node:test";
import assert from "node:assert/strict";
import { coordinatorRow, profilePatch } from "./confirm-profile.ts";
import { parsePcsp } from "./parser.ts";
import { proposeCarryOver } from "./carry-over.ts";
import { initialReview } from "./review.ts";
import { SAMPLE_AGENCY, SAMPLE_PCSP_PAGES } from "./fixture/sample-pages.ts";

const parse = parsePcsp(SAMPLE_PCSP_PAGES, SAMPLE_AGENCY);
const review = () => initialReview(parse, proposeCarryOver([], [], []));

test("only blank profile fields are filled", () => {
  const person = review().person;
  assert.deepEqual(profilePatch(person, {}), {
    patch: {
      client_pid: "0000000",
      date_of_birth: "1990-01-02",
      phone_number: "555-0100",
      physical_address: "100 Sample Street Exampleville, UT 84000",
    },
    filled: ["PID", "date of birth", "phone", "address"],
  });
  const kept = profilePatch(person, { client_pid: "1111111", phone_number: " 555-0199 ", physical_address: "" });
  assert.deepEqual(kept.filled, ["date of birth", "address"]);
  assert.equal(kept.patch.client_pid, undefined);
});

test("a malformed date of birth is never written", () => {
  const person = { ...review().person, dob: "01/02/1990" };
  assert.ok(!profilePatch(person, {}).filled.includes("date of birth"));
});

test("the support coordinator is added once, as primary when there is none", () => {
  const r = review();
  const a = { organizationId: "o", clientId: "c", sort: 3 };
  const row = coordinatorRow(r, { ...a, existing: [] });
  assert.deepEqual(
    row && [row.role, row.name, row.phone, row.email, row.company, row.is_primary, row.sort],
    ["support_coordinator", "Casey Sample", "555-0101", "casey@example.test", "Sample Coordination Co", true, 3],
  );
  assert.equal(coordinatorRow(r, { ...a, existing: [{ name: " casey  SAMPLE", role: "support_coordinator" }] }), null);
  const second = coordinatorRow(r, { ...a, existing: [{ name: "Old Coordinator", role: "support_coordinator" }] });
  assert.equal(second?.is_primary, false);
  r.person.supportCoordinator.include = false;
  assert.equal(coordinatorRow(r, { ...a, existing: [] }), null);
});
