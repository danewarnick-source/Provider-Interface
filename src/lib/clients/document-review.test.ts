import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CLIENT_DOCUMENTS_BUCKET,
  MEDICATION_FIELD_KEY,
  actionsForReviewedFields,
  assertReviewableFields,
  buildProposals,
  clientUploadFolder,
  defaultChecked,
  isClientUploadPath,
  medicationKey,
  reviewableUploadType,
  type ProfileFieldMeta,
  type ReviewField,
} from "./document-review.ts";

const ORG = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

const med = (name: string, dosage: string, extra: Record<string, string> = {}): ReviewField => ({
  field_key: MEDICATION_FIELD_KEY,
  value_json: { medication_name: name, dosage, route: "oral", ...extra },
  confidence: 0.9,
});

describe("upload paths", () => {
  it("puts uploads under the agency folder the storage policy checks", () => {
    assert.equal(clientUploadFolder(ORG, CLIENT, "mar"), `${ORG}/${CLIENT}/mar/`);
    assert.equal(clientUploadFolder(ORG, CLIENT, "dnr status"), `${ORG}/${CLIENT}/dnr_status/`);
  });
  it("accepts only this client's folder", () => {
    assert.ok(isClientUploadPath(`${ORG}/${CLIENT}/mar/1_sheet.pdf`, ORG, CLIENT));
    assert.ok(!isClientUploadPath(`${ORG}/${OTHER}/mar/1_sheet.pdf`, ORG, CLIENT));
    assert.ok(!isClientUploadPath(`${CLIENT}/mar/1_sheet.pdf`, ORG, CLIENT));
    assert.ok(!isClientUploadPath(`${ORG}/${CLIENT}/../${OTHER}/x.pdf`, ORG, CLIENT));
    assert.ok(!isClientUploadPath(`/${ORG}/${CLIENT}/x.pdf`, ORG, CLIENT));
    assert.ok(!isClientUploadPath(`${ORG}/${CLIENT}/`, ORG, CLIENT));
  });
  it("the bucket is fixed", () => {
    assert.equal(CLIENT_DOCUMENTS_BUCKET, "client-documents");
  });
});

describe("reviewable upload types", () => {
  it("reads BSP, MAR and end-of-life documents; normalizes plurals", () => {
    for (const t of ["bsp", "mar", "dnr", "polst", "palliative", "hospice"]) {
      assert.equal(reviewableUploadType(t), t);
    }
    assert.equal(reviewableUploadType("immunizations"), "immunization");
    assert.equal(reviewableUploadType("allergies"), "allergy");
    assert.equal(reviewableUploadType("els_iep"), null);
    assert.equal(reviewableUploadType(undefined), null);
  });
});

describe("what a review may apply", () => {
  it("rejects billing codes, goals, home and the discharge date", () => {
    for (const k of [
      "billing_code_row",
      "pcsp_goal",
      "team_name",
      "discharge_date",
      "pcsp_has_medications",
    ]) {
      assert.throws(() => assertReviewableFields([{ field_key: k }]), /can't be applied/);
    }
  });
  it("accepts profile fields and medications", () => {
    assert.doesNotThrow(() =>
      assertReviewableFields([
        { field_key: "dnr_status" },
        { field_key: MEDICATION_FIELD_KEY },
        { field_key: "bsp_status" },
      ]),
    );
  });
  it("needs Client medical: Edit for medications and medical columns", () => {
    assert.deepEqual(actionsForReviewedFields([{ field_key: "bsp_status" }]), ["edit"]);
    assert.deepEqual(actionsForReviewedFields([{ field_key: MEDICATION_FIELD_KEY }]), [
      "edit",
      "edit_medical",
    ]);
    assert.deepEqual(actionsForReviewedFields([{ field_key: "dnr_status" }]), [
      "edit",
      "edit_medical",
    ]);
  });
});

describe("buildProposals", () => {
  const current: Record<string, unknown> = { bsp_status: "Draft", dnr_status: null };
  const base = {
    currentOf: (m: ProfileFieldMeta) => ("column" in m ? current[m.column] : null),
    existingMedicationKeys: new Set([medicationKey("Med A", "10 mg")]),
    includeMedical: true,
  };

  it("lists each MAR medication as its own row; ones on file are unticked", () => {
    const fields: ReviewField[] = [
      med("Med A", "10 mg"),
      med("Med B", "5 mg", { frequency: "daily" }),
      med("Med B", "5 mg"),
    ];
    const p = buildProposals({ ...base, fields });
    assert.equal(p.length, 2);
    const b = p.find((x) => x.label === "Medication: Med B");
    const a = p.find((x) => x.label === "Medication: Med A");
    assert.ok(a && b);
    assert.equal(b.changed, true);
    assert.equal(a.changed, false);
    assert.equal(a.currentValue, "Already on the medication list");
    assert.match(b.incomingValue, /Med B · 5 mg · oral · daily/);
    assert.equal(b.field.field_key, MEDICATION_FIELD_KEY);
    assert.notEqual(a.field_key, b.field_key);
    const checked = defaultChecked(p);
    assert.equal(checked[b.field_key], true);
    assert.equal(checked[a.field_key], false);
  });

  it("compares profile fields with what is on file", () => {
    const p = buildProposals({
      ...base,
      fields: [
        { field_key: "bsp_status", value_text: "Draft", confidence: 0.9 },
        { field_key: "dnr_status", value_text: "Active", confidence: 0.9 },
      ],
    });
    assert.deepEqual(
      p.map((x) => [x.label, x.changed]),
      [
        ["DNR status", true],
        ["BSP status", false],
      ],
    );
  });

  it("drops low-confidence, blank and unmapped values (never makes anything up)", () => {
    const p = buildProposals({
      ...base,
      fields: [
        { field_key: "bsp_status", value_text: "Final", confidence: 0.3 },
        { field_key: "dnr_status", value_text: "  ", confidence: 0.9 },
        { field_key: "billing_code_row", value_json: { service_code: "SLH" }, confidence: 0.95 },
        { field_key: MEDICATION_FIELD_KEY, value_json: { dosage: "5 mg" }, confidence: 0.9 },
      ],
    });
    assert.equal(p.length, 0);
  });

  it("leaves medical rows out for someone who can't see medical info", () => {
    const p = buildProposals({
      ...base,
      includeMedical: false,
      fields: [
        med("Med B", "5 mg"),
        { field_key: "dnr_status", value_text: "Active" },
        { field_key: "bsp_status", value_text: "Final" },
      ],
    });
    assert.deepEqual(
      p.map((x) => x.label),
      ["BSP status"],
    );
  });
});

describe("wiring", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const fns = read("../import-checklist.functions.ts");
  const ask = read("../../components/clients/shared/nectar-ask.tsx");

  it("the auto-apply upload function is gone", () => {
    assert.doesNotMatch(fns, /extractAndApplyClientUpload/);
    assert.doesNotMatch(ask, /extractAndApplyClientUpload/);
  });
  it("no upload function takes a bucket from the request", () => {
    assert.doesNotMatch(fns, /bucket:\s*z\./);
    assert.doesNotMatch(fns, /storage\s*\.from\(data\.bucket\)/);
  });
  it("upload functions guard with assertCanManageClient and check the path", () => {
    for (const name of [
      "attachClientDocument",
      "previewClientUpdateFromDocument",
      "applySelectedClientFields",
    ]) {
      const body = fns.slice(fns.indexOf(`export const ${name}`));
      const end = body.indexOf("export const", 10);
      const fn = end > 0 ? body.slice(0, end) : body;
      assert.match(fn, /guardClient\(/, name);
      assert.doesNotMatch(fn, /requireAdminForClient/, name);
    }
    assert.match(fns, /assertReviewableFields\(data\.fields\)/);
  });
  it("NectarAsk previews, then applies only ticked rows", () => {
    assert.match(ask, /previewClientUpdateFromDocument/);
    assert.match(ask, /filter\(\(p\) => checked\[p\.field_key\]\)/);
  });
});
