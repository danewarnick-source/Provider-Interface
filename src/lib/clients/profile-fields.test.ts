import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENT_PROFILE_FIELDS,
  PROFILE_CLIENT_COLUMNS,
  PROFILE_CUSTOM_KEYS,
} from "./profile-field-registry.ts";
import {
  formatProfileFieldValue,
  getProfileFieldValue,
  profileFieldHasValue,
} from "./profile-fields.ts";
import type { ClientContact } from "./contacts.ts";

const contact = (p: Partial<ClientContact>): ClientContact => ({
  id: "x", organization_id: "o", client_id: "a", role: "support_coordinator", name: "Sam Coord",
  relationship: null, phone: null, email: null, address: null, company: null, notes: null,
  is_primary: true, sort: 0, ended_on: null, ...p,
});

const field = (role: string, part: string) =>
  CLIENT_PROFILE_FIELDS.find(
    (f) => f.storage.kind === "contact" && f.storage.role === role && f.storage.part === part,
  )!;

describe("contact-backed registry fields", () => {
  it("covers the SOW contact fields and keeps them out of columns and custom values", () => {
    assert.ok(field("support_coordinator", "email").sowRequired);
    assert.ok(field("emergency", "phone").sowRequired);
    assert.ok(field("primary_doctor", "name").sowRequired);
    for (const f of CLIENT_PROFILE_FIELDS.filter((x) => x.storage.kind === "contact")) {
      assert.ok(!PROFILE_CLIENT_COLUMNS.includes(f.key), f.key);
      assert.ok(!PROFILE_CUSTOM_KEYS.includes(f.key), f.key);
    }
    assert.ok(PROFILE_CLIENT_COLUMNS.includes("insurance"));
  });

  it("reads the role's main active contact", () => {
    const contacts = [
      contact({ id: "old", email: "old@x.test", is_primary: false, sort: 1 }),
      contact({ id: "main", email: "sc@x.test" }),
    ];
    assert.equal(getProfileFieldValue({}, {}, field("support_coordinator", "email"), contacts), "sc@x.test");
    assert.equal(formatProfileFieldValue({}, {}, field("support_coordinator", "name"), contacts), "Sam Coord");
    assert.equal(profileFieldHasValue({}, {}, field("support_coordinator", "phone"), contacts), false);
    assert.equal(profileFieldHasValue({}, {}, field("emergency", "name"), contacts), false);
    assert.equal(profileFieldHasValue({}, {}, field("emergency", "name")), false);
  });
});
