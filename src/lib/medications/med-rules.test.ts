import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expectedDoses,
  howTakenFromSupportLevel,
  howTakenLabel,
  prnCheck,
  psychotropicWarnings,
  requiredFieldErrors,
  supportLevelForHowTaken,
  type MedicationFields,
} from "./med-rules.ts";

const complete: MedicationFields = {
  medication_name: "Sertraline",
  dosage: "50 mg",
  route: "oral",
  scheduled_times: ["08:00"],
  purpose: "Depression",
  side_effects: "Upset stomach",
  adverse_effects: "Thoughts of self-harm",
  choking_risk: false,
  how_taken: "assist",
  packaging: "dose pack",
  prescriber: "Dr. Lee",
  start_date: "2026-10-01",
};

const fields = (med: MedicationFields) => requiredFieldErrors(med).map((i) => i.field);

describe("requiredFieldErrors", () => {
  it("passes a complete medication", () => {
    assert.deepEqual(requiredFieldErrors(complete), []);
  });

  it("lists every missing contract field", () => {
    assert.deepEqual(fields({}), [
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
    ]);
  });

  it("accepts strength in place of dose, and as-needed in place of times", () => {
    assert.deepEqual(fields({ ...complete, dosage: null, strength: "50 mg" }), []);
    const prn = { ...complete, scheduled_times: [], is_prn: true };
    assert.deepEqual(fields(prn), [
      "prn_instructions",
      "prn_min_hours",
      "prn_max_per_day",
      "prn_followup_minutes",
    ]);
    assert.deepEqual(
      fields({
        ...prn,
        prn_instructions: "Pain over 5",
        prn_min_hours: 4,
        prn_max_per_day: 3,
        prn_followup_minutes: 60,
      }),
      [],
    );
  });

  it("needs a schedule and count for controlled meds, and approval for the original bottle", () => {
    assert.deepEqual(fields({ ...complete, is_controlled: true }), [
      "controlled_schedule",
      "pill_count_current",
    ]);
    assert.deepEqual(
      fields({
        ...complete,
        is_controlled: true,
        controlled_schedule: "II",
        pill_count_current: 0,
      }),
      [],
    );
    assert.deepEqual(fields({ ...complete, packaging: "original" }), ["packaging_approval_path"]);
    assert.deepEqual(fields({ ...complete, end_date: "2026-09-01" }), ["end_date"]);
  });
});

describe("psychotropicWarnings", () => {
  it("returns nothing for a non-psychotropic med", () => {
    assert.deepEqual(psychotropicWarnings(complete), []);
  });
  it("reminds about what it treats, consent, review, and BSP/HRC when used for behavior", () => {
    const w = psychotropicWarnings({ ...complete, is_psychotropic: true, used_for_behavior: true });
    assert.deepEqual(
      w.map((i) => i.field),
      ["diagnosis", "consent_date", "next_review_date", "bsp_document_id", "hrc_restriction_id"],
    );
    assert.equal(w[1].message, "Missing: consent");
  });
  it("is quiet once everything is on file, and never adds required errors", () => {
    const med = {
      ...complete,
      is_psychotropic: true,
      used_for_behavior: true,
      diagnosis: "Anxiety",
      consent_date: "2026-10-01",
      next_review_date: "2027-01-01",
      bsp_document_id: "d1",
      hrc_restriction_id: "h1",
    };
    assert.deepEqual(psychotropicWarnings(med), []);
    assert.deepEqual(requiredFieldErrors({ ...complete, is_psychotropic: true }), []);
  });
});

describe("how they take it", () => {
  it("labels each value in plain English", () => {
    assert.equal(howTakenLabel("self"), "Takes it on their own with staff watching");
    assert.equal(howTakenLabel("assist"), "Staff help (prompt, open, hand it over)");
    assert.equal(howTakenLabel("nurse"), "Nurse gives it");
    assert.equal(howTakenLabel(null), "Not set");
  });
  it("maps the legacy support level both ways", () => {
    assert.equal(howTakenFromSupportLevel("staff_observed"), "self");
    assert.equal(howTakenFromSupportLevel("staff_administered"), "assist");
    assert.equal(howTakenFromSupportLevel("delegated"), "nurse");
    assert.equal(howTakenFromSupportLevel(null), null);
    assert.equal(supportLevelForHowTaken("self"), "staff_observed");
    assert.equal(supportLevelForHowTaken("nurse", "lpn"), "lpn");
    assert.equal(supportLevelForHowTaken("assist", "lpn"), "staff_administered");
    assert.equal(supportLevelForHowTaken(null, "lpn"), null);
  });
});

describe("prnCheck", () => {
  const now = new Date("2026-10-13T20:00:00Z");
  it("allows the first dose", () => {
    assert.deepEqual(prnCheck({ lastDoses: [], minHours: 4, maxPerDay: 3, now }), {
      tooSoon: false,
      overMax: false,
      nextAllowedAt: null,
    });
  });
  it("flags a dose inside the minimum interval with the next allowed time", () => {
    const r = prnCheck({ lastDoses: ["2026-10-13T18:00:00Z"], minHours: 4, maxPerDay: 3, now });
    assert.equal(r.tooSoon, true);
    assert.equal(r.overMax, false);
    assert.equal(r.nextAllowedAt?.toISOString(), "2026-10-13T22:00:00.000Z");
  });
  it("flags the daily maximum; the slot frees when the oldest counted dose is 24 hours old", () => {
    const r = prnCheck({
      lastDoses: ["2026-10-13T12:00:00Z", "2026-10-12T22:00:00Z", "2026-10-13T06:00:00Z"],
      minHours: 2,
      maxPerDay: 3,
      now,
    });
    assert.equal(r.overMax, true);
    assert.equal(r.tooSoon, false);
    assert.equal(r.nextAllowedAt?.toISOString(), "2026-10-13T22:00:00.000Z");
  });
  it("ignores doses older than 24 hours and future times", () => {
    const r = prnCheck({
      lastDoses: ["2026-10-12T19:00:00Z", "2026-10-14T01:00:00Z"],
      maxPerDay: 1,
      now,
    });
    assert.deepEqual(r, { tooSoon: false, overMax: false, nextAllowedAt: null });
  });
});

describe("expectedDoses", () => {
  const med: MedicationFields = {
    ...complete,
    scheduled_times: ["20:00", "08:00", "8:00"],
    is_active: true,
  };
  it("lists each scheduled time once, sorted, as Denver wall-clock times", () => {
    const doses = expectedDoses(med, "2026-10-13");
    assert.deepEqual(
      doses.map((d) => d.time),
      ["08:00", "20:00"],
    );
    assert.equal(doses[0].scheduledFor, "2026-10-13T14:00:00.000Z");
    assert.equal(doses[0].held, false);
  });
  it("has none before the start, after the stop date or once stopped, and none for PRNs", () => {
    assert.deepEqual(expectedDoses(med, "2026-09-30"), []);
    assert.deepEqual(expectedDoses({ ...med, end_date: "2026-10-12" }, "2026-10-13"), []);
    assert.deepEqual(
      expectedDoses(
        { ...med, is_active: false, discontinued_at: "2026-10-13T15:00:00Z" },
        "2026-10-13",
      ),
      [],
    );
    assert.equal(
      expectedDoses({ ...med, discontinued_at: "2026-10-14T15:00:00Z" }, "2026-10-13").length,
      2,
    );
    assert.deepEqual(expectedDoses({ ...med, is_prn: true }, "2026-10-13"), []);
  });
  it("marks doses held from the day a med is paused", () => {
    const paused = { ...med, paused_at: "2026-10-13T15:00:00Z" };
    assert.equal(expectedDoses(paused, "2026-10-12")[0].held, false);
    assert.equal(expectedDoses(paused, "2026-10-13")[0].held, true);
  });
});
