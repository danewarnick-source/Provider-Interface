import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./agency-policies.functions.ts", import.meta.url), "utf8");

describe("agency-policies.functions.ts (N4: the admin binder is gone)", () => {
  it("keeps only what new-hire matching and My Obligations still read", () => {
    assert.deepEqual(
      [...SRC.matchAll(/^export (?:const|async function) (\w+)/gm)].map((m) => m[1]),
      ["assignMatchingPoliciesForStaffInternal", "getAgencyPolicyForInstance"],
    );
  });

  it("no longer adds policies, files or obligations from an admin screen", () => {
    assert.doesNotMatch(SRC, /\.insert\(|createSignedUploadUrl|company_obligations/);
    assert.doesNotMatch(SRC, /listAgencyPolicies|createAgencyPolicy|listPolicyJobCodeOptions/);
    const lib = readFileSync(new URL("./agency-policies.ts", import.meta.url), "utf8");
    assert.doesNotMatch(lib, /isAllowedPolicyFile|policyHasContent|AGENCY_POLICY_ATTESTATION/);
  });

  it("a policy instance opens only for its assignee or an agency-wide admin", () => {
    const get = SRC.slice(SRC.indexOf("export const getAgencyPolicyForInstance"));
    assert.match(
      get,
      /await requireOrgMembership\(supabase, userId, data\.organizationId, "staff"\);/,
    );
    assert.match(get, /if \(!assignee && !isAdmin\) return \{ policy: null, signedUrl: null \};/);
    assert.ok(SRC.split("\n").length <= 300);
  });
});
