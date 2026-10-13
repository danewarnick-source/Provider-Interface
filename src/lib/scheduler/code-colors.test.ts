import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classesForCode, cssVarForCode, familyForCode, isDailyCode, isHourlyCode, maxRecommendedHours,
} from "./code-colors.ts";

describe("code families", () => {
  it("maps codes to their family, case-insensitively", () => {
    assert.equal(familyForCode("rhs"), "residential");
    assert.equal(familyForCode("SLH"), "supported_living");
    assert.equal(familyForCode("DSI"), "day_supports");
    assert.equal(familyForCode("SEI"), "employment");
    assert.equal(familyForCode("RP3"), "respite");
    assert.equal(familyForCode("PM1"), "other");
    assert.equal(familyForCode(null), "other");
  });

  it("classes and css vars follow the family", () => {
    assert.match(classesForCode("RHS").bg, /teal/);
    assert.equal(cssVarForCode("SLH"), "--sched-supported-living");
  });
});

describe("daily vs hourly", () => {
  it("follows service-billing's daily list", () => {
    assert.equal(isDailyCode("rhs"), true);
    assert.equal(isDailyCode("PN1"), true);
    assert.equal(isDailyCode("RL6"), false);
    assert.equal(isHourlyCode("SLH"), true);
    assert.equal(isHourlyCode("HHS"), false);
    assert.equal(isDailyCode(null), false);
  });

  it("recommended maximum hours", () => {
    assert.equal(maxRecommendedHours("dsi"), 6);
    assert.equal(maxRecommendedHours("DSG"), 8);
    assert.equal(maxRecommendedHours("SLH"), null);
  });
});
