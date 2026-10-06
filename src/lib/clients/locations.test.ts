import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOCATION_RADIUS_DEFAULT_FEET,
  activeLocations,
  cleanLocationDraft,
  locationSummary,
} from "./locations.ts";

describe("cleanLocationDraft", () => {
  it("trims and defaults the clock-in distance", () => {
    const r = cleanLocationDraft({
      label: "  Day program ",
      address: " 1 Test Way, Testville, UT ",
    });
    assert.deepEqual(r, {
      ok: true,
      value: {
        label: "Day program",
        address: "1 Test Way, Testville, UT",
        radiusFeet: LOCATION_RADIUS_DEFAULT_FEET,
      },
    });
  });

  it("refuses a missing name, address or an out-of-range distance", () => {
    assert.deepEqual(cleanLocationDraft({ label: "", address: "x" }), {
      ok: false,
      error: "Give the location a name",
    });
    assert.deepEqual(cleanLocationDraft({ label: "x", address: " " }), {
      ok: false,
      error: "Enter the street address",
    });
    const far = cleanLocationDraft({ label: "x", address: "y", radiusFeet: 9000 });
    assert.equal(far.ok, false);
    const near = cleanLocationDraft({ label: "x", address: "y", radiusFeet: 50 });
    assert.equal(near.ok, false);
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
