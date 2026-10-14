import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SRC = readFileSync(new URL("./support.functions.ts", import.meta.url), "utf8");

function serverFn(name: string): string {
  const start = SRC.indexOf(`export const ${name} = createServerFn`);
  assert.ok(start >= 0, `${name} is exported`);
  const next = SRC.indexOf("\nexport const ", start + 1);
  return SRC.slice(start, next < 0 ? undefined : next);
}

describe("support.functions.ts: Ask the PI team (moved in N5)", () => {
  it("keeps the two functions admin Nectar uses, and nothing else", () => {
    const exported = [...SRC.matchAll(/^export const (\w+) = createServerFn/gm)].map((m) => m[1]);
    assert.deepEqual(exported, ["escalateHelpToHive", "getHelpTicketStatus"]);
  });

  it("checks signed in, active member and the nectar feature before any read or write (no AI setting: no model call)", () => {
    for (const name of ["escalateHelpToHive", "getHelpTicketStatus"]) {
      const fn = serverFn(name);
      assert.match(fn, /\.middleware\(\[requireSupabaseAuth\]\)/, name);
      const guard = fn.indexOf(
        "await requireNectarOrg(context, { orgId: data.organizationId, feature: null })",
      );
      assert.ok(guard > 0 && guard < fn.indexOf('.from("org_support_tickets")'), name);
    }
  });

  it("files the ticket for the caller's agency and reads a ticket only within it", () => {
    assert.match(
      serverFn("escalateHelpToHive"),
      /organization_id: orgId,\s*opened_by: userId,\s*source: "nectar_help"/,
    );
    assert.match(
      serverFn("getHelpTicketStatus"),
      /\.eq\("id", data\.ticketId\)\s*\.eq\("organization_id", orgId\)/,
    );
  });
});
