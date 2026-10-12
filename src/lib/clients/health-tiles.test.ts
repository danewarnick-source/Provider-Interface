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
    const t = dietTile({ dysphagia: true, swallowingAlerts: ["Thickened liquids"], diet: null });
    assert.deepEqual(t, { value: "Trouble swallowing", note: "Thickened liquids", warn: true });
    assert.equal(dietTile({ dysphagia: false, swallowingAlerts: [], diet: "Low salt" }).note, "Low salt");
    assert.equal(
      dietTile({ dysphagia: null, swallowingAlerts: null, diet: " " }).value,
      "No special diet on file",
    );
  });
  it("mobility reads notes and equipment", () => {
    assert.equal(mobilityTile({ mobility: null, equipment: null }).value, "Not on file");
    assert.deepEqual(mobilityTile({ mobility: "Uses a walker", equipment: "Shower chair" }), {
      value: "Uses a walker",
      note: "Equipment: Shower chair",
      warn: false,
    });
  });
  it("emergency plan: DNR/POLST and the treatment authorization", () => {
    const dnr = emergencyPlanTile({ dnrStatus: "DNR", polstStatus: null, treatmentAuthorization: true });
    assert.equal(dnr.value, "DNR on file");
    assert.equal(dnr.note, "Emergency treatment authorization signed");
    const none = emergencyPlanTile({ dnrStatus: null, polstStatus: null, treatmentAuthorization: false });
    assert.equal(none.value, "Advance directive not set");
    assert.equal(none.warn, true);
    assert.equal(
      emergencyPlanTile({ dnrStatus: null, polstStatus: "POLST", treatmentAuthorization: true }).value,
      "POLST on file",
    );
  });
  it("event dots by type", () => {
    assert.equal(healthEventTone("hospital"), "danger");
    assert.equal(healthEventTone("exam"), "info");
    assert.equal(healthEventTone("immunization"), "ok");
    assert.equal(healthEventTone("whatever"), "neutral");
  });
});
