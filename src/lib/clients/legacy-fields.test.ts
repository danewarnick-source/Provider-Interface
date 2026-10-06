import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { legacyContactsForClient, singleSourcesFromLegacy } from "./legacy-fields.ts";

describe("legacyContactsForClient", () => {
  it("maps each old column group to a role", () => {
    const out = legacyContactsForClient({
      guardian_name: "Gwen Sample",
      guardian_phone: "555-0101",
      guardian_relationship: "Mother",
      guardian_email: "g@example.test",
      emergency_contact_name: "Eli Sample",
      emergency_contact_phone: "555-0102",
      emergency_contact_instructions: "Call after 5",
      support_coordinator_name: "Sam Coord",
      support_coordinator_email: "sc@example.test",
      support_coordinator_company: "Coord Co",
      primary_care_name: "Dr Primary",
      physician_address: "1 Clinic Way",
      dentist_name: "Dr Tooth",
      dentist_address: "2 Smile St",
      med_prescriber_name: "Dr Rx",
      residential_provider: "Home Provider",
    });
    const byRole = Object.fromEntries(out.map((c) => [`${c.role}:${c.name}`, c]));
    assert.equal(byRole["guardian:Gwen Sample"].relationship, "Mother");
    assert.equal(byRole["guardian:Gwen Sample"].email, "g@example.test");
    assert.equal(byRole["guardian:Gwen Sample"].is_primary, true);
    assert.equal(byRole["emergency:Eli Sample"].notes, "Call after 5");
    assert.equal(byRole["support_coordinator:Sam Coord"].company, "Coord Co");
    assert.equal(byRole["primary_doctor:Dr Primary"].address, "1 Clinic Way");
    assert.equal(byRole["dentist:Dr Tooth"].address, "2 Smile St");
    assert.equal(byRole["prescriber:Dr Rx"].is_primary, false);
    assert.equal(byRole["other_provider:Home Provider"].relationship, "Residential provider");
    assert.equal(out.length, 7);
  });

  it("skips empty values and names a nameless contact after its role", () => {
    const out = legacyContactsForClient({
      guardian_name: "  ",
      emergency_contact_name: "",
      emergency_contact_phone: "555-0199",
      neurologist_name: null,
    });
    assert.deepEqual(
      out.map((c) => [c.role, c.name, c.phone]),
      [["emergency", "Emergency contact", "555-0199"]],
    );
  });

  it("de-duplicates the same role + name + phone (phone digits only)", () => {
    const out = legacyContactsForClient(
      {
        emergency_contact_name: "Eli Sample",
        emergency_contact_phone: "(555) 010-2000",
        primary_care_name: "Dr Same",
        primary_care_phone: "555-0300",
        pcp_name: "dr same",
        pcp_phone: "5550300",
      },
      [{ name: "Eli Sample", phone: "555-010-2000", relationship: null }],
    );
    assert.equal(out.filter((c) => c.role === "emergency").length, 1);
    assert.equal(out.filter((c) => c.role === "primary_doctor").length, 1);
  });

  it("keeps extra emergency rows (ended when archived) and external services", () => {
    const out = legacyContactsForClient(
      {},
      [
        { name: "Old Contact", phone: "555-0400", relationship: "Aunt", archived_at: "2026-02-03T10:00:00Z" },
        { name: "New Contact", phone: null, relationship: null },
      ],
      [{ provider_name: "Day Place", service_code: "dsg", note: "Weekdays" }],
    );
    const old = out.find((c) => c.name === "Old Contact")!;
    assert.equal(old.ended_on, "2026-02-03");
    assert.equal(old.sort, 2);
    assert.equal(out.find((c) => c.name === "New Contact")!.sort, 3);
    const svc = out.find((c) => c.role === "other_provider")!;
    assert.equal(svc.relationship, "Provides DSG");
    assert.equal(svc.notes, "Weekdays");
  });
});

describe("singleSourcesFromLegacy", () => {
  it("builds insurance and about me from the old columns", () => {
    const r = singleSourcesFromLegacy({
      medical_insurance: "Medicaid",
      private_insurance: "Plan A",
      medicare_number: "M-1",
      preferred_activities: ["Hiking", "Music"],
      preferred_living: "Own apartment",
    });
    assert.equal(r.insurance, "Medicaid\nPrivate: Plan A\nMedicare: M-1");
    assert.equal(r.about_me, "Enjoys: Hiking, Music\nPreferred living: Own apartment");
  });

  it("keeps existing values", () => {
    const r = singleSourcesFromLegacy({ insurance: "Set", about_me: "Set", medical_insurance: "Other" });
    assert.equal(r.insurance, "Set");
    assert.equal(r.about_me, "Set");
  });

  it("appends alert, health notes and diet to must-knows only when not already there", () => {
    const r = singleSourcesFromLegacy({
      special_directions: "Needs reminders. Seizure plan on file.",
      clinical_alert: "Seizure plan on file.",
      pertinent_health_notes: "Wears glasses",
      dietary_needs: "Soft foods",
    });
    assert.equal(r.special_directions, "Needs reminders. Seizure plan on file.\nWears glasses\nDiet: Soft foods");
  });

  it("does not repeat health notes equal to the alert", () => {
    const r = singleSourcesFromLegacy({ clinical_alert: "Same", pertinent_health_notes: "Same" });
    assert.equal(r.special_directions, "Same");
  });

  it("uses the old profile photo only when the client photo is empty", () => {
    assert.equal(singleSourcesFromLegacy({ profile_photo_url: "old.jpg" }).client_photo_url, "old.jpg");
    assert.equal(
      singleSourcesFromLegacy({ client_photo_url: "new.jpg", profile_photo_url: "old.jpg" }).client_photo_url,
      "new.jpg",
    );
    assert.equal(singleSourcesFromLegacy({}).client_photo_url, null);
  });
});

describe("LEGACY_CONTACT_KEYS / legacyContactKey", () => {
  it("maps old keys to role, part and slot both ways", async () => {
    const { LEGACY_CONTACT_KEYS, legacyContactKey } = await import("./legacy-fields.ts");
    assert.deepEqual(LEGACY_CONTACT_KEYS.guardian_phone, { role: "guardian", part: "phone", slot: 0 });
    assert.deepEqual(LEGACY_CONTACT_KEYS.emergency_contact_2_name, { role: "emergency", part: "name", slot: 1 });
    assert.deepEqual(LEGACY_CONTACT_KEYS.pcp_phone, { role: "primary_doctor", part: "phone", slot: 1 });
    assert.equal(LEGACY_CONTACT_KEYS.physician_address.slot, 0);
    assert.equal(legacyContactKey("support_coordinator", "email"), "support_coordinator_email");
    assert.equal(legacyContactKey("emergency", "phone", 1), "emergency_contact_2_phone");
    assert.throws(() => legacyContactKey("representative", "name"), /No legacy key/);
  });
});
