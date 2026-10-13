import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allergyTile,
  dietTile,
  emergencyPlanTile,
  healthEventTone,
  mobilityTile,
} from "./health-tiles.ts";

describe("health tiles", () => {
  it("allergies: count, first few, amber when any", () => {
    assert.deepEqual(allergyTile([]), { value: "None on file", note: null, warn: false });
    assert.deepEqual(allergyTile(["Peanuts", "Latex", "Bees", "Dust"]), {
      value: "4 allergies",
      note: "Peanuts, Latex, Bees +1 more",
      warn: true,
    });
    assert.equal(allergyTile(["Peanuts"]).value, "1 allergy");
  });
  it("diet includes swallowing", () => {
    const t = dietTile({ dysphagia: true, swallowingAlerts: ["Thickened liquids"], diets: [] });
    assert.deepEqual(t, { value: "Trouble swallowing", note: "Thickened liquids", warn: true });
    assert.equal(
      dietTile({ dysphagia: true, swallowingAlerts: [], diets: ["Pureed"] }).note,
      "Pureed",
    );
    assert.deepEqual(dietTile({ dysphagia: false, swallowingAlerts: [], diets: ["Low sodium"] }), {
      value: "Special diet",
      note: "Low sodium",
      warn: false,
    });
    assert.equal(
      dietTile({ dysphagia: null, swallowingAlerts: null, diets: [" "] }).value,
      "No special diet on file",
    );
  });
  it("mobility: the first need, then the rest", () => {
    assert.equal(mobilityTile(null).value, "Not on file");
    assert.deepEqual(mobilityTile(["Walker", "Gait belt", "Fall risk", "No stairs"]), {
      value: "Walker",
      note: "Gait belt, Fall risk +1 more",
      warn: false,
    });
    assert.equal(mobilityTile(["Cane"]).note, null);
  });
  it("emergency plan: the plan's first line and the directive", () => {
    const none = emergencyPlanTile({ plan: null, dnrStatus: null, polstStatus: null });
    assert.deepEqual(none, { value: "No plan written", note: null, warn: true });
    const dnr = emergencyPlanTile({
      plan: "\nCall 911.\nThen call the guardian.",
      dnrStatus: "DNR",
      polstStatus: null,
    });
    assert.deepEqual(dnr, { value: "Call 911.", note: "DNR on file", warn: true });
    const plain = emergencyPlanTile({ plan: "Call 911.", dnrStatus: null, polstStatus: null });
    assert.equal(plain.warn, false);
    assert.equal(
      emergencyPlanTile({ plan: "x".repeat(80), dnrStatus: null, polstStatus: "POLST" }).value.length,
      60,
    );
  });
  it("event dots by type", () => {
    assert.equal(healthEventTone("hospital"), "danger");
    assert.equal(healthEventTone("exam"), "info");
    assert.equal(healthEventTone("immunization"), "ok");
    assert.equal(healthEventTone("whatever"), "neutral");
  });
});
