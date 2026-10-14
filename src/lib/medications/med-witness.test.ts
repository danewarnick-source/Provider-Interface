import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { witnessProblem } from "./med-witness.ts";

const ok = { organization_id: "org", active: true, deleted_at: null };

describe("witnessProblem", () => {
  it("accepts a different, active member of the agency", () => {
    assert.equal(
      witnessProblem({ witnessId: "w", callerId: "me", organizationId: "org", membership: ok }),
      null,
    );
  });

  it("refuses the staff member themselves, outsiders and inactive accounts", () => {
    assert.match(
      witnessProblem({ witnessId: "me", callerId: "me", organizationId: "org", membership: ok }) ??
        "",
      /someone else/,
    );
    assert.match(
      witnessProblem({ witnessId: "w", callerId: "me", organizationId: "org", membership: null }) ??
        "",
      /this agency/,
    );
    assert.match(
      witnessProblem({
        witnessId: "w",
        callerId: "me",
        organizationId: "org",
        membership: { ...ok, active: false },
      }) ?? "",
      /isn't active/,
    );
    assert.match(
      witnessProblem({
        witnessId: "w",
        callerId: "me",
        organizationId: "org",
        membership: { ...ok, deleted_at: "2026-01-01" },
      }) ?? "",
      /isn't active/,
    );
  });

  it("the witness proves it with their own sign-in and the server writes the confirmation", () => {
    const src = readFileSync(new URL("./med-witness.functions.ts", import.meta.url), "utf8");
    assert.match(src, /performPasswordSignInWithClient/);
    assert.match(src, /signOut\(\{ scope: "local" \}\)/);
    assert.match(src, /from\("med_witness_confirmations"\)\s*\.insert/);
    assert.doesNotMatch(
      src,
      /performPasswordSignIn\(/,
      "never writes the staff member's session cookie",
    );
  });
});
