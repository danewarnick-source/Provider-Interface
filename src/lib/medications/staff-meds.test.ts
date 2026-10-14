import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STAFF_MED_COLUMNS,
  TRAINING_MED_COLUMNS,
  readOnlyMedView,
  staffVisibleMeds,
  trainingMedItems,
} from "./staff-meds.ts";
import { ANY_MED_BAD_REACTION } from "./reference.ts";

describe("STAFF_MED_COLUMNS", () => {
  it("selects the new fields and drops the old ones", () => {
    const cols = STAFF_MED_COLUMNS.split(", ");
    for (const c of [
      "strength",
      "dose_form",
      "how_taken",
      "purpose",
      "side_effects",
      "adverse_effects",
      "choking_risk",
      "contributes_to_swallowing_difficulty",
      "prn_try_first",
      "prn_min_hours",
      "prn_max_per_day",
      "prn_call_if",
      "is_rescue",
      "is_psychotropic",
      "psychotropic_type",
      "used_for_behavior",
      "bsp_document_id",
      "is_controlled",
      "controlled_schedule",
      "scheduled_times",
    ])
      assert.ok(cols.includes(c), c);
    for (const c of ["scheduled_time", "self_admin_med_support", "support_level", "frequency"])
      assert.ok(!cols.includes(c), c);
    assert.ok(!TRAINING_MED_COLUMNS.split(", ").includes("frequency"));
  });
});

describe("staffVisibleMeds", () => {
  it("keeps active meds only, sorted by time with PRNs last", () => {
    const out = staffVisibleMeds([
      { id: "prn", medication_name: "A", is_prn: true },
      { id: "pm", medication_name: "B", scheduled_times: ["20:00"] },
      { id: "am", medication_name: "C", scheduled_times: ["08:00"] },
      { id: "paused", medication_name: "D", paused_at: "2026-10-01T00:00:00Z" },
      { id: "stopped", medication_name: "E", is_active: false },
      { id: "disc", medication_name: "F", discontinued_at: "2026-10-01T00:00:00Z" },
    ]);
    assert.deepEqual(
      out.map((m) => m.id),
      ["am", "pm", "prn"],
    );
  });
});

describe("readOnlyMedView", () => {
  it("shows name, dose, when, purpose, how taken, watch for", () => {
    const v = readOnlyMedView({
      id: "1",
      medication_name: "Sertraline",
      strength: "50 mg",
      dose_form: "tablet",
      route: "by mouth",
      scheduled_times: ["20:00", "08:00"],
      purpose: "Depression",
      how_taken: "assist",
      side_effects: "Upset stomach",
      adverse_effects: "Rash",
    });
    assert.equal(v.title, "Sertraline 50 mg");
    assert.equal(v.subtitle, "tablet · by mouth");
    assert.deepEqual(v.lines, [
      { label: "When given", value: "8:00 AM, 8:00 PM" },
      { label: "What it's for", value: "Depression" },
      { label: "How they take it", value: "Staff help (prompt, open, hand it over)" },
      { label: "Watch for", value: "Upset stomach" },
    ]);
    assert.equal(v.badReaction, "Rash");
    assert.equal(v.anyMedBadReaction, ANY_MED_BAD_REACTION);
    assert.equal(v.prn, null);
    assert.equal(v.psychotropic, null);
    assert.equal(v.countRequired, false);
    assert.equal(v.swallowingRisk, false);
  });

  it("lists PRN rules", () => {
    const v = readOnlyMedView({
      id: "1",
      medication_name: "Ibuprofen",
      is_prn: true,
      prn_instructions: "Pain over 4",
      prn_try_first: "Rest",
      prn_min_hours: 6,
      prn_max_per_day: 3,
      prn_call_if: "Pain lasts 2 days",
    });
    assert.equal(v.lines[0].value, "As needed");
    assert.deepEqual(v.prn, [
      { label: "When to give", value: "Pain over 4" },
      { label: "Try first", value: "Rest" },
      { label: "Wait at least", value: "6 hours between doses" },
      { label: "No more than", value: "3 a day" },
      { label: "Call if", value: "Pain lasts 2 days" },
    ]);
    assert.ok(v.isPrn);
  });

  it("marks psychotropic use, the plan link, count and swallowing risk", () => {
    const v = readOnlyMedView({
      id: "1",
      medication_name: "Risperidone",
      is_psychotropic: true,
      psychotropic_type: "antipsychotic",
      diagnosis: "Schizophrenia",
      used_for_behavior: true,
      bsp_document_id: "doc-1",
      is_controlled: true,
      contributes_to_swallowing_difficulty: true,
    });
    assert.deepEqual(v.psychotropic, [
      { label: "Type", value: "Antipsychotic" },
      { label: "What it treats", value: "Schizophrenia" },
      { label: "Used for behavior", value: "Yes" },
    ]);
    assert.equal(v.bspDocumentId, "doc-1");
    assert.ok(v.usedForBehavior);
    assert.ok(v.countRequired);
    assert.ok(v.swallowingRisk);
  });

  it("hides the plan link when not used for behavior", () => {
    const v = readOnlyMedView({
      id: "1",
      is_psychotropic: true,
      used_for_behavior: false,
      bsp_document_id: "doc-1",
    });
    assert.equal(v.bspDocumentId, null);
    assert.equal(v.title, "Unnamed medication");
  });
});

describe("trainingMedItems", () => {
  it("adds route, purpose, side effects, bad reaction, PRN rules and psychotropic use", () => {
    const items = trainingMedItems([
      {
        medication_name: "Lorazepam",
        strength: "1 mg",
        dosage: "1 tablet",
        route: "by mouth",
        purpose: "Anxiety",
        side_effects: "Sleepy",
        adverse_effects: "Trouble breathing",
        is_prn: true,
        prn_instructions: "Panic attack",
        prn_min_hours: 8,
        is_psychotropic: true,
        psychotropic_type: "anti-anxiety",
        used_for_behavior: true,
        choking_risk: false,
      },
      { medication_name: "Stopped", is_active: false },
    ]);
    assert.equal(items.length, 1);
    const pairs = Object.fromEntries(items[0].pairs.map((p) => [p.label, p.value]));
    assert.equal(items[0].label, "Lorazepam 1 mg");
    assert.equal(pairs["Dose"], "1 tablet");
    assert.equal(pairs["Route"], "by mouth");
    assert.equal(pairs["When given"], "As needed");
    assert.equal(pairs["What it's for"], "Anxiety");
    assert.equal(pairs["Side effects"], "Sleepy");
    assert.equal(pairs["Signs of a bad reaction"], "Trouble breathing");
    assert.equal(pairs["PRN"], "Yes");
    assert.equal(
      pairs["PRN rules"],
      "When to give: Panic attack; Wait at least: 8 hours between doses",
    );
    assert.equal(pairs["Psychotropic"], "Yes (anti-anxiety), used for behavior");
    assert.equal(pairs["Choking risk flagged"], "No");
  });

  it("leaves PRN rules and psychotropic out for a plain scheduled med", () => {
    const [item] = trainingMedItems([{ medication_name: "Vitamin D", scheduled_times: ["08:00"] }]);
    const labels = item.pairs.map((p) => p.label);
    assert.ok(!labels.includes("PRN rules"));
    assert.ok(!labels.includes("Psychotropic"));
    assert.equal(item.pairs.find((p) => p.label === "Dose")?.value, "—");
  });
});
