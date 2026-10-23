// CS3: writes that take only a client id run the full client guard (category,
// client in this agency, scope), not a level-only check.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("client-id writes use the client guard", () => {
  const server = read("./guards.server.ts");
  const pin = read("./evv/home-pin.functions.ts");
  const vis = read("./profile/staff-visibility.functions.ts");
  const ic = read("../import-checklist.functions.ts");

  it("assertCanManageClientById resolves the client's agency, checks a sent agency, then guards", () => {
    assert.match(server, /export async function assertCanManageClientById/);
    assert.match(server, /args\.organizationId && args\.organizationId !== orgId/);
    assert.match(server, /await assertCanManageClient\(\{ supabase, actorId, organizationId: orgId, clientId, action \}\)/);
  });

  it("home pin writes: guard + admin level, scoped to the client's agency", () => {
    assert.match(pin, /assertCanManageClientById\(/);
    assert.match(pin, /requireOrgMembership\(sb, userId, organizationId, "admin"\)/);
    assert.doesNotMatch(pin, /isAdminLevel/);
    assert.equal((pin.match(/\.eq\("organization_id", organizationId\)/g) ?? []).length, 3);
  });

  it("staff visibility: guard + admin level before the read and write", () => {
    assert.match(vis, /assertCanManageClientById\(/);
    assert.match(vis, /requireOrgMembership\(supabase, context\.userId, organizationId, "admin"\)/);
    assert.ok(vis.indexOf("assertCanManageClientById(") < vis.indexOf('.from("client_staff_visibility")'));
  });

  it("client document signing uses the guard; no admin-only shortcuts", () => {
    assert.doesNotMatch(ic, /requireAdminForClient/);
    assert.doesNotMatch(ic, /isAdminLevel/);
    const fn = (name: string) => {
      const start = ic.indexOf(`export const ${name} =`);
      assert.ok(start >= 0, name);
      const next = ic.indexOf("export const ", start + 10);
      return ic.slice(start, next < 0 ? undefined : next);
    };
    assert.match(fn("signClientDocument"), /guardClient\([^)]*\["view"\]\)/);
    assert.match(fn("signClientDocument"), /"admin"\)/);
  });
});
