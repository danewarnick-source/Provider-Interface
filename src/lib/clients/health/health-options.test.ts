import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HEALTH_LISTS,
  addHealthItem,
  cleanEmergencyPlan,
  editHealthItem,
  healthList,
  optionsToAdd,
  removeHealthItem,
  type HealthListKey,
} from "./health-options.ts";

describe("HEALTH_LISTS", () => {
  it("has a label, empty text and unique choices for every list", () => {
    for (const [key, def] of Object.entries(HEALTH_LISTS)) {
      assert.equal(def.key, key);
      assert.ok(def.label && def.empty, key);
      assert.ok(def.options.length >= 5, key);
      const lower = def.options.map((o) => o.toLowerCase());
      assert.equal(new Set(lower).size, lower.length, `${key} has duplicate choices`);
    }
  });
  it("covers the six Health tab lists", () => {
    const keys: HealthListKey[] = [
      "allergies",
      "diagnoses",
      "chronic_conditions",
      "diets",
      "swallowing_alerts",
      "mobility",
    ];
    assert.deepEqual(Object.keys(HEALTH_LISTS).sort(), [...keys].sort());
  });
});

describe("optionsToAdd", () => {
  it("leaves out choices already on the list, ignoring case", () => {
    const left = optionsToAdd("mobility", ["walker", "Fall risk"]);
    assert.ok(!left.includes("Walker"));
    assert.ok(!left.includes("Fall risk"));
    assert.ok(left.includes("Cane"));
  });
  it("offers every choice for an empty list", () => {
    assert.equal(optionsToAdd("allergies", null).length, HEALTH_LISTS.allergies.options.length);
  });
});

describe("addHealthItem / editHealthItem / removeHealthItem", () => {
  it("adds a trimmed item at the end", () => {
    assert.deepEqual(addHealthItem(["Latex"], "  Peanuts  "), ["Latex", "Peanuts"]);
    assert.deepEqual(addHealthItem(null, "Bee   stings"), ["Bee stings"]);
  });
  it("refuses blanks and duplicates", () => {
    assert.throws(() => addHealthItem(["Latex"], "   "), /Type what to add/);
    assert.throws(() => addHealthItem(["Latex"], "latex"), /already on the list/);
    assert.throws(() => addHealthItem([], "x".repeat(201)), /under 200/);
  });
  it("edits one item in place", () => {
    assert.deepEqual(editHealthItem(["Cane", "Walker"], 1, "Rollator walker"), [
      "Cane",
      "Rollator walker",
    ]);
    assert.deepEqual(editHealthItem(["Cane"], 0, "cane "), ["cane"]);
  });
  it("refuses an edit that duplicates another item or a missing index", () => {
    assert.throws(() => editHealthItem(["Cane", "Walker"], 1, "CANE"), /already on the list/);
    assert.throws(() => editHealthItem(["Cane"], 3, "Walker"), /no longer on the list/);
  });
  it("removes one item and keeps the rest in order", () => {
    assert.deepEqual(removeHealthItem(["A", "B", "C"], 1), ["A", "C"]);
    assert.deepEqual(removeHealthItem(null, 0), []);
  });
  it("drops blank stored items", () => {
    assert.deepEqual(healthList([" A ", "", "  "]), ["A"]);
  });
});

describe("cleanEmergencyPlan", () => {
  it("trims and saves a blank plan as null", () => {
    assert.equal(
      cleanEmergencyPlan("  Call 911, then the guardian.  "),
      "Call 911, then the guardian.",
    );
    assert.equal(cleanEmergencyPlan("   "), null);
    assert.equal(cleanEmergencyPlan(null), null);
  });
});
