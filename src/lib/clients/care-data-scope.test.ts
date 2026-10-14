import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { effectiveCategories } from "../access/can.ts";
import type { CategoryId, CategoryValue } from "../access/categories.ts";
import { careDataReach, scopeCareData, staffContacts } from "./care-data-scope.ts";

const cats = (over: Partial<Record<CategoryId, CategoryValue>>) => ({
  ...effectiveCategories({ level: "staff", presetCategories: {}, overrides: {} }),
  ...over,
});

const payload = () => {
  const staffCare = {
    identity: { id: "c", medicaid_id: null as string | null },
    medications: [{ id: "m1" }],
    contacts: [{ role: "emergency" }],
    goals: [{ id: "g1" }],
    authorized_codes: [] as { service_code: string }[],
    custom_fields: [] as { id: string }[],
  };
  return {
    identity: { id: "c", medicaid_id: "PLACEHOLDER-ID" as string | null },
    medications: [{ id: "m1" }, { id: "m2-hidden" }],
    contacts: [{ role: "emergency" }, { role: "dentist" }],
    goals: [{ id: "g1" }, { id: "g2-hidden" }],
    authorized_codes: [{ service_code: "SLH" }],
    custom_fields: [{ id: "f1" }],
    about_me: null,
    visibility: { staffCare },
  };
};

describe("careDataReach", () => {
  it("staff without Clients / Client medical view get the staff view", () => {
    const r = careDataReach({
      categories: cats({ clients: "off", client_medical: "off" }),
      scope: "self",
      canSeeClient: true,
    });
    assert.deepEqual(r, { fullRecord: false, fullMedical: false });
  });
  it("Clients: View gives the record; Client medical: View gives the meds", () => {
    assert.deepEqual(
      careDataReach({
        categories: cats({ clients: "view", client_medical: "off" }),
        scope: "agency",
        canSeeClient: false,
      }),
      { fullRecord: true, fullMedical: false },
    );
    assert.deepEqual(
      careDataReach({
        categories: cats({ clients: "view", client_medical: "view" }),
        scope: "agency",
        canSeeClient: false,
      }),
      { fullRecord: true, fullMedical: true },
    );
  });
  it("a scoped manager gets the staff view for a client outside their scope", () => {
    const c = cats({ clients: "edit", client_medical: "edit" });
    assert.deepEqual(careDataReach({ categories: c, scope: "assigned", canSeeClient: false }), {
      fullRecord: false,
      fullMedical: false,
    });
    assert.deepEqual(careDataReach({ categories: c, scope: "assigned", canSeeClient: true }), {
      fullRecord: true,
      fullMedical: true,
    });
  });
});

describe("scopeCareData", () => {
  it("staff response has no Medicaid ID, extra contacts or hidden meds", () => {
    const out = scopeCareData(payload(), { fullRecord: false, fullMedical: false });
    assert.equal(out.identity.medicaid_id, null);
    assert.deepEqual(out.contacts, [{ role: "emergency" }]);
    assert.deepEqual(out.medications, [{ id: "m1" }]);
    assert.deepEqual(out.goals, [{ id: "g1" }]);
    assert.deepEqual(out.authorized_codes, []);
    assert.deepEqual(out.custom_fields, []);
    assert.doesNotMatch(JSON.stringify(out), /PLACEHOLDER-ID|dentist|m2-hidden|g2-hidden/);
  });
  it("keeps the staff medications M4 reads", () => {
    const out = scopeCareData(payload(), { fullRecord: false, fullMedical: false });
    assert.deepEqual(out.visibility.staffCare.medications, [{ id: "m1" }]);
  });
  it("admins keep the full payload", () => {
    const p = payload();
    const out = scopeCareData(p, { fullRecord: true, fullMedical: true });
    assert.equal(out.identity.medicaid_id, "PLACEHOLDER-ID");
    assert.equal(out.medications.length, 2);
    assert.equal(out.contacts.length, 2);
  });
});

describe("staffContacts", () => {
  it("keeps guardian, emergency, coordinator and primary doctor only", () => {
    const roles = [
      "guardian",
      "emergency",
      "support_coordinator",
      "primary_doctor",
      "dentist",
      "representative",
      null,
    ];
    assert.deepEqual(
      staffContacts(roles.map((role) => ({ role }))).map((c) => c.role),
      ["guardian", "emergency", "support_coordinator", "primary_doctor"],
    );
  });
});

describe("wiring", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  it("getClientCareData scopes its response", () => {
    const fn = read("./care-data.functions.ts");
    assert.match(fn, /return scopeCareData\(/);
    assert.match(fn, /careDataReach\(/);
    assert.match(fn, /contacts: contactsStaff/);
  });
  it("M4's read-only list reads the staff medications", () => {
    const list = read("../../components/medications/meds-read-only-list.tsx");
    assert.match(list, /visibility\.staffCare\.medications/);
  });
  it("the staff workspace hides the face sheet without Client medical: View", () => {
    const ws = read("../../routes/dashboard.workspace.$clientId.tsx");
    assert.match(ws, /canCategory\("client_medical", "view"\)[\s\S]*<FaceSheetButton/);
  });
  it("the face sheet checks view_medical and logs PHI access", () => {
    const fs = read("./face-sheet.functions.ts");
    assert.match(fs, /action: "view_medical"/);
    assert.match(fs, /logPhiAccess\(/);
  });
});
