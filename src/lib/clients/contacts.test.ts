import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeContacts,
  cleanContactFields,
  contactLine,
  contactsByClient,
  contactCardOrder,
  contactInitials,
  contactTag,
  pastContacts,
  contactsWithRole,
  guardianSatisfied,
  primaryContact,
  setContactParts,
  type ClientContact,
  type ContactRole,
} from "./contacts.ts";

const NOW = new Date(2026, 9, 6, 12);

function c(p: Partial<ClientContact>): ClientContact {
  return {
    id: p.id ?? "x",
    organization_id: "o",
    client_id: p.client_id ?? "a",
    role: p.role ?? "emergency",
    name: p.name ?? "Sample Person",
    relationship: p.relationship ?? null,
    phone: p.phone ?? null,
    email: null,
    address: null,
    company: null,
    notes: null,
    is_primary: p.is_primary ?? false,
    sort: p.sort ?? 0,
    ended_on: p.ended_on ?? null,
  };
}

const list = [
  c({ id: "1", role: "emergency", name: "Second", sort: 1 }),
  c({ id: "2", role: "emergency", name: "Main", is_primary: true, sort: 3 }),
  c({ id: "3", role: "emergency", name: "Ended", ended_on: "2026-10-06" }),
  c({ id: "4", role: "guardian", name: "Guard", ended_on: "2026-12-01" }),
  c({ id: "5", role: "dentist", name: "Teeth", client_id: "b" }),
];

describe("activeContacts", () => {
  it("drops contacts ended today or earlier", () => {
    assert.deepEqual(activeContacts(list, NOW).map((x) => x.id), ["1", "2", "4", "5"]);
  });
});

describe("contactsWithRole / primaryContact", () => {
  it("orders primary first then by sort", () => {
    assert.deepEqual(contactsWithRole(list, "emergency", NOW).map((x) => x.id), ["2", "1"]);
    assert.equal(primaryContact(list, "emergency", NOW)?.name, "Main");
  });
  it("falls back to the first contact and returns null when none", () => {
    assert.equal(primaryContact(list, "guardian", NOW)?.name, "Guard");
    assert.equal(primaryContact(list, "psychiatrist", NOW), null);
  });
});

describe("contact cards", () => {
  it("orders guardian first, then support coordinator, then everyone else by name", () => {
    const c = (id: string, role: ContactRole, name: string, is_primary = false) => ({
      id,
      role,
      name,
      is_primary,
      sort: 0,
      ended_on: null,
    });
    const order = contactCardOrder([
      c("1", "emergency", "Zed"),
      c("2", "primary_doctor", "Amy"),
      c("3", "support_coordinator", "Cole"),
      c("4", "guardian", "Gus"),
      c("5", "guardian", "Bea", true),
    ]).map((x) => x.id);
    assert.deepEqual(order, ["5", "4", "3", "2", "1"]);
  });
  it("tags roles in plain words", () => {
    assert.deepEqual(contactTag("primary_doctor"), { label: "Doctor", tone: "ok" });
    assert.equal(contactTag("support_coordinator").label, "Support coordinator");
    assert.equal(contactTag("emergency").label, "Emergency");
    assert.equal(contactTag("guardian").label, "Guardian");
  });
  it("lists ended contacts as past, newest first; never drops them", () => {
    const past = pastContacts(
      [
        { id: "a", ended_on: "2026-01-01" },
        { id: "b", ended_on: null },
        { id: "c", ended_on: "2026-05-01" },
        { id: "d", ended_on: "2099-01-01" },
      ],
      NOW,
    ).map((x) => x.id);
    assert.deepEqual(past, ["c", "a"]);
  });
  it("makes initials", () => {
    assert.equal(contactInitials("Ada Lovelace King"), "AL");
    assert.equal(contactInitials("  "), "?");
  });
});

describe("contactsByClient", () => {
  it("groups by client", () => {
    const m = contactsByClient(list);
    assert.equal(m.get("a")?.length, 4);
    assert.equal(m.get("b")?.length, 1);
  });
});

describe("contactLine", () => {
  it("joins name, relationship and phone", () => {
    assert.equal(contactLine({ name: "Pat", relationship: "Mother", phone: "555-0100" }), "Pat (Mother) · 555-0100");
    assert.equal(contactLine({ name: "Pat", relationship: null, phone: null }), "Pat");
    assert.equal(contactLine(null), "");
  });
});

describe("cleanContactFields", () => {
  it("trims and turns blanks into null", () => {
    const f = cleanContactFields({ role: "dentist", name: "  Dr Sample ", phone: " ", email: "a@b.test" });
    assert.equal(f.name, "Dr Sample");
    assert.equal(f.phone, null);
    assert.equal(f.email, "a@b.test");
    assert.equal(f.is_primary, false);
  });
  it("requires a name", () => {
    assert.throws(() => cleanContactFields({ role: "guardian", name: "  " }), /needs a name/);
  });
});

describe("guardianSatisfied", () => {
  it("is met by self-guardian or an active guardian with a phone", () => {
    assert.equal(guardianSatisfied(true, [], NOW), true);
    assert.equal(guardianSatisfied(null, [], NOW), false);
    assert.equal(guardianSatisfied(false, [], NOW), false);
    assert.equal(guardianSatisfied(false, [c({ role: "guardian", phone: "555-0100" })], NOW), true);
    assert.equal(guardianSatisfied(false, [c({ role: "guardian", phone: null })], NOW), false);
    assert.equal(
      guardianSatisfied(false, [c({ role: "guardian", phone: "555-0100", ended_on: "2026-01-01" })], NOW),
      false,
    );
  });
});

/** Tiny in-memory stand-in for the supabase client_contacts calls setContactParts makes. */
function fakeContactsDb(rows: ClientContact[]) {
  const writes: Array<{ op: string; values: Record<string, unknown>; id?: string }> = [];
  const result = (data: unknown) => ({ then: (res: (v: unknown) => unknown) => res({ data, error: null }) });
  const sb = {
    from: () => ({
      select: () => {
        const q = { in: () => q, order: () => q, ...result(rows) };
        return q;
      },
      update: (values: Record<string, unknown>) => ({
        eq: (_k: string, id: string) => ({
          select: () => (writes.push({ op: "update", values, id }), result([{ id }])),
        }),
      }),
      insert: (values: Record<string, unknown>) => ({
        select: () => (writes.push({ op: "insert", values }), result([{ id: "new" }])),
      }),
    }),
  };
  return { sb, writes };
}

describe("setContactParts", () => {
  const base = { organizationId: "o", clientId: "a" };
  it("updates the main contact for the role, skipping a blank name and clearing blank parts", async () => {
    const { sb, writes } = fakeContactsDb([c({ id: "g1", role: "guardian", is_primary: true, phone: "1" })]);
    const id = await setContactParts(sb, { ...base, role: "guardian", parts: { name: " ", phone: " 555 ", email: "" } });
    assert.equal(id, "g1");
    assert.deepEqual(writes, [{ op: "update", values: { phone: "555", email: null }, id: "g1" }]);
  });
  it("adds the contact named after its role when there is none", async () => {
    const { sb, writes } = fakeContactsDb([]);
    const id = await setContactParts(sb, { ...base, role: "support_coordinator", parts: { email: "sc@x.test" } });
    assert.equal(id, "new");
    assert.equal(writes[0].op, "insert");
    assert.equal(writes[0].values.name, "Support coordinator");
    assert.equal(writes[0].values.email, "sc@x.test");
    assert.equal(writes[0].values.is_primary, true);
  });
  it("targets the second contact with slot 1 and writes nothing for empty input", async () => {
    const { sb, writes } = fakeContactsDb([c({ id: "e1", role: "emergency", is_primary: true })]);
    await setContactParts(sb, { ...base, role: "emergency", slot: 1, parts: { name: "Second" } });
    assert.equal(writes[0].op, "insert");
    assert.equal(writes[0].values.is_primary, false);
    assert.equal(await setContactParts(sb, { ...base, role: "dentist", parts: { phone: "" } }), null);
  });
});
