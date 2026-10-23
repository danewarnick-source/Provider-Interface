import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientContact } from "./contacts.ts";
import { guardianGap, guardianLabel, guardianStatus } from "./guardian.ts";

const NOW = new Date(2026, 9, 7, 12);

function c(p: Partial<ClientContact>): ClientContact {
  return {
    id: p.id ?? "x",
    organization_id: "o",
    client_id: "a",
    role: p.role ?? "guardian",
    name: p.name ?? "Pat Example",
    relationship: p.relationship ?? null,
    phone: p.phone ?? null,
    email: null,
    address: null,
    company: null,
    notes: null,
    is_primary: p.is_primary ?? false,
    sort: p.sort ?? 0,
    ended_on: p.ended_on ?? null,
    created_at: "2026-01-01T00:00:00Z",
  } as ClientContact;
}

describe("guardianStatus", () => {
  it("own guardian wins over any contact", () => {
    assert.deepEqual(guardianStatus(true, [c({ phone: "555-0100" })], NOW), { kind: "own" });
  });

  it("missing with no active guardian, whether or not the flag was answered", () => {
    assert.equal(guardianStatus(false, [], NOW).kind, "missing");
    assert.equal(guardianStatus(null, [], NOW).kind, "missing");
    assert.equal(
      guardianStatus(false, [c({ role: "emergency", phone: "555-0100" })], NOW).kind,
      "missing",
    );
    assert.equal(
      guardianStatus(false, [c({ phone: "555-0100", ended_on: "2026-01-01" })], NOW).kind,
      "missing",
    );
  });

  it("a guardian with no phone is on the profile but not reachable", () => {
    const s = guardianStatus(false, [c({ name: "Jill Sample", relationship: "Mother" })], NOW);
    assert.equal(s.kind, "no_phone");
    assert.equal(s.kind === "no_phone" && s.guardian.name, "Jill Sample");
  });

  it("on file when any active guardian has a phone; that one is shown", () => {
    const s = guardianStatus(
      null,
      [
        c({ id: "1", name: "First", is_primary: true }),
        c({ id: "2", name: "Second", phone: "555-0101", sort: 1 }),
      ],
      NOW,
    );
    assert.equal(s.kind, "on_file");
    assert.equal(s.kind === "on_file" && s.guardian.name, "Second");
  });
});

describe("guardianGap", () => {
  it("names the gap, or null when covered", () => {
    assert.equal(guardianGap({ kind: "missing" }), "Guardian not on file");
    assert.equal(guardianGap({ kind: "no_phone" }), "Guardian has no phone");
    assert.equal(guardianGap({ kind: "on_file" }), null);
    assert.equal(guardianGap({ kind: "own" }), null);
  });
});

describe("guardianLabel", () => {
  it("adds the relationship when there is one", () => {
    assert.equal(
      guardianLabel({ name: "Pat Example", relationship: " Mother " }),
      "Pat Example (Mother)",
    );
    assert.equal(guardianLabel({ name: "Pat Example", relationship: null }), "Pat Example");
  });
});
