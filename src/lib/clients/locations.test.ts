import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOCATION_RADIUS_DEFAULT_FEET,
  activeLocations,
  cleanLocationDraft,
  locationReasonLabel,
  locationSummary,
} from "./locations.ts";

describe("cleanLocationDraft", () => {
  it("trims and defaults the clock-in distance", () => {
    const r = cleanLocationDraft({
      label: "  Day program ",
      address: " 1 Test Way, Testville, UT ",
      reason: "day_program",
      reasonNote: "ignored unless Other",
    });
    assert.deepEqual(r, {
      ok: true,
      value: {
        label: "Day program",
        address: "1 Test Way, Testville, UT",
        radiusFeet: LOCATION_RADIUS_DEFAULT_FEET,
        reason: "day_program",
        reasonNote: null,
        pin: null,
      },
    });
  });

  it("refuses a missing name, address or an out-of-range distance", () => {
    assert.deepEqual(cleanLocationDraft({ label: "", address: "x", reason: "school" }), {
      ok: false,
      error: "Give the location a name",
    });
    assert.deepEqual(cleanLocationDraft({ label: "x", address: " ", reason: "school" }), {
      ok: false,
      error: "Enter the street address",
    });
    const far = cleanLocationDraft({ label: "x", address: "y", radiusFeet: 9000, reason: "school" });
    assert.equal(far.ok, false);
    const near = cleanLocationDraft({ label: "x", address: "y", radiusFeet: 50, reason: "school" });
    assert.equal(near.ok, false);
  });

  it("requires a reason, and a note for Other", () => {
    assert.deepEqual(cleanLocationDraft({ label: "x", address: "y" }), {
      ok: false,
      error: "Choose a reason for this location",
    });
    assert.deepEqual(cleanLocationDraft({ label: "x", address: "y", reason: "nope" }), {
      ok: false,
      error: "Choose a reason for this location",
    });
    assert.deepEqual(cleanLocationDraft({ label: "x", address: "y", reason: "other", reasonNote: " " }), {
      ok: false,
      error: "Add a short note for Other",
    });
    const other = cleanLocationDraft({ label: "x", address: "y", reason: "other", reasonNote: " Church " });
    assert.equal(other.ok && other.value.reasonNote, "Church");
  });

  it("keeps a valid dropped pin and refuses a bad one", () => {
    const ok = cleanLocationDraft({ label: "x", address: "y", reason: "job_site", pin: { lat: 40.7, lng: -111.9 } });
    assert.deepEqual(ok.ok && ok.value.pin, { lat: 40.7, lng: -111.9 });
    const bad = cleanLocationDraft({ label: "x", address: "y", reason: "job_site", pin: { lat: 0, lng: 0 } });
    assert.equal(bad.ok, false);
  });
});

describe("locationReasonLabel", () => {
  it("names the reason, with the note for Other, and null for old rows", () => {
    assert.equal(locationReasonLabel({ reason: "family_home", reason_note: null }), "Family home");
    assert.equal(locationReasonLabel({ reason: "other", reason_note: "Church" }), "Other: Church");
    assert.equal(locationReasonLabel({ reason: null, reason_note: null }), null);
  });
});

describe("activeLocations", () => {
  it("drops ended rows and sorts by name", () => {
    const rows = [
      { label: "Work", archived_at: null },
      { label: "Old", archived_at: "2026-01-01T00:00:00Z" },
      { label: "Day program", archived_at: null },
    ];
    assert.deepEqual(
      activeLocations(rows).map((r) => r.label),
      ["Day program", "Work"],
    );
  });

  it("summarises name and distance", () => {
    assert.equal(locationSummary({ label: "Work", geofence_radius_feet: 300 }), "Work · 300 ft");
  });
});
