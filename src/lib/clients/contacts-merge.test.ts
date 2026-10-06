import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planContactMerge } from "./contacts-merge.ts";
import type { ClientContact } from "./contacts.ts";
import type { BackfilledContact } from "./legacy-fields.ts";

const have = (p: Partial<ClientContact>): ClientContact => ({
  id: p.id ?? "e", organization_id: "o", client_id: "a", role: p.role ?? "emergency", name: p.name ?? "Sample Person",
  relationship: null, phone: null, email: null, address: null, company: null, notes: null,
  is_primary: p.is_primary ?? true, sort: 0, ended_on: null, ...p,
});
const incoming = (p: Partial<BackfilledContact>): BackfilledContact => ({
  role: p.role ?? "emergency", name: p.name ?? "Sample Person", relationship: null, phone: null, email: null,
  address: null, company: null, notes: null, is_primary: p.is_primary ?? true, sort: 0, ended_on: null, ...p,
});

describe("planContactMerge", () => {
  it("adds new people; only the first of a role is the main one", () => {
    const plan = planContactMerge(
      [have({ id: "g", role: "guardian", name: "Gwen" })],
      [incoming({ role: "guardian", name: "Other Guardian" }), incoming({ role: "dentist", name: "Dr Tooth" })],
    );
    assert.deepEqual(plan.inserts.map((c) => [c.role, c.name, c.is_primary]), [
      ["guardian", "Other Guardian", false],
      ["dentist", "Dr Tooth", true],
    ]);
  });

  it("fills empty parts of the same person and flags different values", () => {
    const plan = planContactMerge(
      [have({ id: "e1", name: "Eli Sample", phone: "(555) 010-0000", email: null })],
      [incoming({ name: "eli sample", phone: "555-010-0000", email: "eli@x.test", address: "1 Main" })],
    );
    assert.deepEqual(plan.inserts, []);
    assert.deepEqual(plan.fills, [{ id: "e1", patch: { email: "eli@x.test", address: "1 Main" } }]);
    assert.deepEqual(plan.conflicts, []);

    const conflict = planContactMerge(
      [have({ id: "e1", name: "Eli Sample", phone: "555-0100" })],
      [incoming({ name: "Eli Sample", phone: "555-0199" })],
    );
    assert.deepEqual(conflict.conflicts, [
      { field: "contact:emergency.phone", existing: "555-0100", incoming: "555-0199" },
    ]);
  });

  it("matches by phone, and a role-only import onto the role's main contact", () => {
    const plan = planContactMerge(
      [have({ id: "sc", role: "support_coordinator", name: "Sam Coord", phone: "5550123" })],
      [
        incoming({ role: "support_coordinator", name: "Support coordinator", email: "sc@x.test" }),
        incoming({ role: "support_coordinator", name: "S. Coord", phone: "555-0123", company: "Coord Co" }),
      ],
    );
    assert.deepEqual(plan.inserts, []);
    assert.deepEqual(plan.fills, [
      { id: "sc", patch: { email: "sc@x.test" } },
      { id: "sc", patch: { company: "Coord Co" } },
    ]);
  });
});

describe("applyContactMergePlan", () => {
  it("inserts scoped rows and applies fills", async () => {
    const { applyContactMergePlan } = await import("./contacts-merge.ts");
    const calls: unknown[] = [];
    const ok = { error: null };
    const sb = {
      from: () => ({
        insert: async (rows: unknown) => (calls.push(["insert", rows]), ok),
        update: (patch: unknown) => ({ eq: async (_k: string, id: string) => (calls.push(["update", id, patch]), ok) }),
      }),
    };
    const n = await applyContactMergePlan(sb, "o", "a", {
      inserts: [incoming({ name: "New" })],
      fills: [{ id: "e1", patch: { email: "x@y.test" } }],
      conflicts: [],
    });
    assert.equal(n, 2);
    assert.equal((calls[0] as [string, Array<{ client_id: string }>])[1][0].client_id, "a");
    assert.deepEqual(calls[1], ["update", "e1", { email: "x@y.test" }]);
  });
});
