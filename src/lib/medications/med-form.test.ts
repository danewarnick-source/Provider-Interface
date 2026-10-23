import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyReference,
  emptyMedForm,
  medFormErrors,
  medFormFromRow,
  medInputFromForm,
  strengthOptions,
  type MedFormValues,
} from "./med-form.ts";
import { getReference } from "./reference.ts";

const complete: MedFormValues = {
  ...emptyMedForm("2026-10-01"),
  medication_name: "Sertraline",
  strength: "50 mg",
  dosage: "1 tablet",
  route: "By mouth",
  scheduled_times: ["08:00"],
  purpose: "Depression",
  side_effects: "Upset stomach",
  adverse_effects: "Rash",
  choking_risk: false,
  how_taken: "assist",
  packaging: "dose pack",
  prescriber: "Dr. Lee",
};

describe("med-form", () => {
  it("has no errors for a complete scheduled med", () => {
    assert.deepEqual(medFormErrors(complete), {});
  });

  it("flags every missing contract field on an empty form", () => {
    const keys = Object.keys(medFormErrors(emptyMedForm()));
    for (const k of [
      "medication_name",
      "dosage",
      "route",
      "scheduled_times",
      "purpose",
      "side_effects",
      "adverse_effects",
      "choking_risk",
      "how_taken",
      "packaging",
      "prescriber",
      "start_date",
    ]) {
      assert.ok(keys.includes(k), `missing ${k}`);
    }
  });

  it("PRN needs its own rules and drops scheduled times", () => {
    const prn = { ...complete, is_prn: true, prn_followup_minutes: "" };
    assert.deepEqual(Object.keys(medFormErrors(prn)).sort(), [
      "prn_followup_minutes",
      "prn_instructions",
      "prn_max_per_day",
      "prn_min_hours",
    ]);
    const input = medInputFromForm({
      ...prn,
      prn_instructions: "Pain",
      prn_min_hours: "4",
      prn_max_per_day: "3",
      prn_followup_minutes: "60",
    });
    assert.deepEqual(input.scheduled_times, []);
    assert.equal(input.prn_min_hours, 4);
    assert.equal(input.prn_max_per_day, 3);
  });

  it("clears unticked parts", () => {
    const input = medInputFromForm({
      ...complete,
      prn_instructions: "stale",
      is_rescue: true,
      diagnosis: "stale",
      consent_date: "2026-01-01",
      controlled_schedule: "II",
      pill_count_current: "30",
    });
    assert.equal(input.prn_instructions, null);
    assert.equal(input.is_rescue, false);
    assert.equal(input.diagnosis, null);
    assert.equal(input.consent_date, null);
    assert.equal(input.controlled_schedule, null);
    assert.equal(input.pill_count_current, null);
  });

  it("keeps behavior links only when used for behavior", () => {
    const base = {
      ...complete,
      is_psychotropic: true,
      bsp_document_id: "b",
      hrc_restriction_id: "h",
    };
    assert.equal(medInputFromForm(base).bsp_document_id, null);
    assert.equal(medInputFromForm({ ...base, used_for_behavior: true }).hrc_restriction_id, "h");
  });

  it("reads a saved row", () => {
    const v = medFormFromRow({
      medication_name: "Tylenol",
      start_date: "2026-10-01",
      scheduled_times: ["08:00"],
      choking_risk: true,
      how_taken: "nurse",
      prn_min_hours: 4,
      prn_followup_minutes: null,
      is_prn: false,
      bsp_document_id: null,
    });
    assert.equal(v.medication_name, "Tylenol");
    assert.equal(v.choking_risk, true);
    assert.equal(v.how_taken, "nurse");
    assert.equal(v.prn_min_hours, "4");
    assert.equal(v.prn_followup_minutes, "60");
    assert.equal(v.bsp_document_id, null);
    assert.equal(medFormFromRow({ how_taken: "bogus" }).how_taken, null);
  });

  it("splits reference forms into strength picks", () => {
    assert.deepEqual(
      strengthOptions(["tablet 325, 500 mg", "suppository", "ear drops 6.5%"]).map((o) => o.label),
      ["tablet 325 mg", "tablet 500 mg", "suppository", "ear drops 6.5%"],
    );
    assert.deepEqual(strengthOptions(["liquid 160 mg/5 mL"])[0], {
      doseForm: "liquid",
      strength: "160 mg/5 mL",
      label: "liquid 160 mg/5 mL",
    });
  });

  it("suggests from the built-in list without touching dose or times", () => {
    const ref = getReference("quetiapine");
    assert.ok(ref);
    const start = {
      ...emptyMedForm(),
      dosage: "1 tab",
      scheduled_times: ["20:00"],
      side_effects: "Typed",
    };
    const { values, suggested } = applyReference(start, ref);
    assert.equal(values.reference_key, "quetiapine");
    assert.equal(values.dosage, "1 tab");
    assert.deepEqual(values.scheduled_times, ["20:00"]);
    assert.equal(values.side_effects, "Typed");
    assert.ok(!suggested.has("side_effects"));
    assert.equal(values.is_psychotropic, true);
    assert.equal(values.psychotropic_type, "antipsychotic");
    // A second pick replaces earlier suggestions.
    const acet = getReference("acetaminophen");
    assert.ok(acet);
    const again = applyReference(values, acet, suggested);
    assert.equal(again.values.is_psychotropic, false);
    assert.equal(again.values.adverse_effects, acet.badReaction);
  });
});
