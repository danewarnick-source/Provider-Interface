import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MED_ROUTES,
  formatTime12,
  howTakenSummary,
  medStatus,
  medicationBadges,
  nameWithStrength,
  sortMedications,
  sortedTimes,
  splitByStatus,
  statusReason,
  whenGivenLabel,
} from "./med-display.ts";

describe("med-display", () => {
  it("offers one route list to the form and Give meds", () => {
    assert.equal(MED_ROUTES[0], "By mouth");
    assert.ok(MED_ROUTES.includes("Feeding tube"));
  });

  it("formats times in 12-hour form", () => {
    assert.equal(formatTime12("08:00"), "8:00 AM");
    assert.equal(formatTime12("20:30"), "8:30 PM");
    assert.equal(formatTime12("00:15"), "12:15 AM");
    assert.equal(formatTime12("12:00"), "12:00 PM");
    assert.equal(formatTime12("later"), "later");
  });

  it("sorts and de-duplicates times", () => {
    assert.deepEqual(sortedTimes(["20:00", "8:00", "08:00", "bad"]), ["08:00", "20:00"]);
  });

  it("labels when it's given", () => {
    assert.equal(whenGivenLabel({ scheduled_times: ["20:00", "08:00"] }), "8:00 AM, 8:00 PM");
    assert.equal(whenGivenLabel({ is_prn: true, scheduled_times: ["08:00"] }), "As needed");
    assert.equal(whenGivenLabel({ scheduled_times: [] }), "No times set");
  });

  it("shows strength, else dose", () => {
    assert.equal(
      nameWithStrength({ medication_name: "Sertraline", strength: "50 mg" }),
      "Sertraline 50 mg",
    );
    assert.equal(
      nameWithStrength({ medication_name: "Tylenol", dosage: "2 tabs" }),
      "Tylenol 2 tabs",
    );
    assert.equal(nameWithStrength({ medication_name: "Vitamin D" }), "Vitamin D");
  });

  it("sorts by first time of day with PRNs last", () => {
    const sorted = sortMedications([
      { medication_name: "B", is_prn: true },
      { medication_name: "C", scheduled_times: ["20:00"] },
      { medication_name: "A", scheduled_times: ["21:00", "07:00"] },
      { medication_name: "D", scheduled_times: [] },
    ]);
    assert.deepEqual(
      sorted.map((m) => m.medication_name),
      ["A", "C", "D", "B"],
    );
  });

  it("splits active from paused and stopped, with reasons", () => {
    const meds = [
      { medication_name: "Active", is_active: true },
      {
        medication_name: "Paused",
        is_active: true,
        paused_at: "2026-10-01T00:00:00Z",
        pause_reason: "In hospital",
      },
      {
        medication_name: "Stopped",
        is_active: false,
        discontinued_at: "2026-10-01T00:00:00Z",
        stop_reason: "Side effects",
      },
    ];
    const { active, inactive } = splitByStatus(meds);
    assert.deepEqual(
      active.map((m) => m.medication_name),
      ["Active"],
    );
    assert.deepEqual(
      inactive.map((m) => medStatus(m)),
      ["paused", "stopped"],
    );
    assert.equal(statusReason(meds[1]), "Paused: In hospital");
    assert.equal(statusReason(meds[2]), "Stopped: Side effects");
    assert.equal(statusReason(meds[0]), null);
  });

  it("builds badges", () => {
    const labels = medicationBadges({
      is_prn: true,
      is_rescue: true,
      is_psychotropic: true,
      is_controlled: true,
      controlled_schedule: "II",
      choking_risk: true,
      packaging: "original",
    }).map((b) => b.label);
    assert.deepEqual(labels, [
      "PRN",
      "Rescue",
      "Psychotropic",
      "C-II",
      "Swallowing risk",
      "Not dose-packed",
    ]);
    assert.deepEqual(medicationBadges({ packaging: "dose pack" }), []);
  });

  it("summarizes how they take their active meds", () => {
    assert.equal(
      howTakenSummary([
        { how_taken: "assist" },
        { how_taken: "assist" },
        { how_taken: "assist", paused_at: "2026-10-01T00:00:00Z" },
        { how_taken: "self" },
        { how_taken: "nurse", is_active: false, discontinued_at: "2026-10-01T00:00:00Z" },
        { how_taken: null },
      ]),
      "Staff help with 3 · On their own with 1 · Nurse gives 0",
    );
  });
});
