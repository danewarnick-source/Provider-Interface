import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./access.server.ts", import.meta.url), "utf8");

function body(name: string): string {
  const start = SRC.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is exported`);
  const next = SRC.indexOf("export ", start + 1);
  return SRC.slice(start, next < 0 ? undefined : next);
}

describe("access.server.ts (N3 library guards)", () => {
  it("admin: signed in, Nectar on for the agency, agency_settings at the asked level, agency-wide scope", () => {
    const admin = body("requireLibraryAdmin");
    const steps = [
      "signedIn(context)",
      "await requireNectarOrg(context, { orgId, feature: null })",
      'await requireCategory(db, userId, orgId, "agency_settings", min)',
      "if (!isAgencyAdmin(access.level, access.scope)) throw new Error(LIBRARY_ADMIN_ONLY)",
    ];
    let at = -1;
    for (const step of steps) {
      const next = admin.indexOf(step);
      assert.ok(next > at, `${step} runs in order`);
      at = next;
    }
  });

  it("member: signed in, Nectar on for the agency, and an active membership", () => {
    const member = body("requireLibraryMember");
    assert.match(member, /signedIn\(context\)/);
    assert.match(member, /await requireNectarOrg\(context, \{ orgId, feature: null \}\)/);
    assert.match(member, /await requireOrgMembership\(db, userId, orgId\)/);
  });

  it("refuses a signed-out request before any read", () => {
    assert.match(
      SRC,
      /if \(!context\.supabase \|\| !context\.userId\) throw new Error\(LIBRARY_SIGNED_OUT\)/,
    );
  });
});
