import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  audienceColumns,
  audienceMembers,
  audienceWarning,
  isInAudience,
  isVisibleToMember,
} from "./audience.ts";

const ANA = "11111111-1111-4111-8111-111111111111";
const BEN = "22222222-2222-4222-8222-222222222222";
const CAL = "33333333-3333-4333-8333-333333333333";
const MEMBERS = [ANA, BEN, CAL];

const forAll = { audience_all: true, policy_assigned_users: [] as string[] };
const forAna = { audience_all: false, policy_assigned_users: [ANA] };

describe("who a library document is for (Decision 5)", () => {
  it("All team members: everyone", () => {
    for (const id of MEMBERS) assert.equal(isInAudience(forAll, id), true);
    assert.deepEqual(audienceMembers(forAll, MEMBERS), MEMBERS);
  });

  it("Only the people I check: just them", () => {
    assert.equal(isInAudience(forAna, ANA), true);
    assert.equal(isInAudience(forAna, BEN), false);
    assert.deepEqual(audienceMembers(forAna, MEMBERS), [ANA]);
  });

  it("a missing flag counts as all team members; a checked person who left drops out of the count", () => {
    assert.equal(isInAudience({ audience_all: null, policy_assigned_users: null }, BEN), true);
    assert.deepEqual(
      audienceMembers({ audience_all: false, policy_assigned_users: [ANA, "gone"] }, MEMBERS),
      [ANA],
    );
  });

  it("a team member sees only published documents meant for them", () => {
    assert.equal(isVisibleToMember({ ...forAna, library_status: "published" }, ANA), true);
    assert.equal(isVisibleToMember({ ...forAna, library_status: "published" }, BEN), false);
    assert.equal(isVisibleToMember({ ...forAll, library_status: "draft" }, ANA), false);
    assert.equal(isVisibleToMember({ ...forAll, library_status: "archived" }, ANA), false);
  });

  it("saves the two options: all clears the list, checked keeps only active members once", () => {
    assert.deepEqual(audienceColumns({ all: true }, MEMBERS), {
      audience_all: true,
      policy_assigned_users: [],
    });
    assert.deepEqual(
      audienceColumns({ all: false, userIds: [BEN, BEN, "not-a-member", CAL] }, MEMBERS),
      {
        audience_all: false,
        policy_assigned_users: [BEN, CAL],
      },
    );
  });

  it("warns when nobody is checked", () => {
    assert.equal(audienceWarning(forAll), null);
    assert.equal(audienceWarning(forAna), null);
    assert.match(
      audienceWarning({ audience_all: false, policy_assigned_users: [] }) ?? "",
      /Nobody is checked/,
    );
  });
});
