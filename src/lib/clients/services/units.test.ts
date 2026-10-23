import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { usedUnitsForCode, worstUnitsLeft, type UsageTimesheet } from "./units.ts";

const sheet = (
  code: string,
  inAt: string,
  outAt: string,
  extra: Partial<UsageTimesheet> = {},
): UsageTimesheet => ({
  service_type_code: code,
  clock_in_timestamp: inAt,
  clock_out_timestamp: outAt,
  rounded_clock_in: null,
  rounded_clock_out: null,
  corrected_clock_in: null,
  corrected_clock_out: null,
  review_status: "approved",
  shift_note_text: null,
  ...extra,
});

const dsi = {
  service_code: "DSI",
  service_start_date: "2026-07-01",
  service_end_date: "2027-06-30",
  annual_unit_authorization: 100,
};

describe("usedUnitsForCode", () => {
  it("rounds each entry to the nearest quarter hour and sums entries", () => {
    const a = sheet("DSI", "2026-08-01T15:00:00Z", "2026-08-01T15:07:00Z"); // 7m → 0
    const b = sheet("DSI", "2026-08-02T15:00:00Z", "2026-08-02T15:07:00Z"); // 7m → 0
    const used = usedUnitsForCode(dsi, [a, b], []);
    assert.equal(used.usedUnits, 0); // a summed 14m would round to 1 — per-entry gives 0
  });

  it("ignores other codes and entries outside the window", () => {
    const rows = [
      sheet("DSI", "2026-08-01T15:00:00Z", "2026-08-01T16:00:00Z"),
      sheet("SEI", "2026-08-01T15:00:00Z", "2026-08-01T16:00:00Z"),
      sheet("DSI", "2026-06-01T15:00:00Z", "2026-06-01T16:00:00Z"),
    ];
    assert.equal(usedUnitsForCode(dsi, rows, []).usedUnits, 4);
  });

  it("counts distinct billable days for daily codes", () => {
    const hhs = { ...dsi, service_code: "HHS" };
    const days = [
      { record_date: "2026-08-01", service_code: "HHS" },
      { record_date: "2026-08-01", service_code: "HHS" },
      { record_date: "2026-08-02", service_code: "HHS" },
      { record_date: "2026-08-03", service_code: "RHS" },
    ];
    assert.equal(usedUnitsForCode(hhs, [], days).usedUnits, 2);
  });

  it("RHS counts a day only with a real note of 50+ characters", () => {
    const rhs = { ...dsi, service_code: "RHS" };
    const long = "x".repeat(60);
    const rows = [
      sheet("RHS", "2026-08-01T15:00:00Z", "2026-08-01T20:00:00Z", { shift_note_text: long }),
      sheet("RHS", "2026-08-02T15:00:00Z", "2026-08-02T20:00:00Z", { shift_note_text: "short" }),
    ];
    assert.equal(usedUnitsForCode(rhs, rows, []).usedUnits, 1);
  });

  it("is zero without a start date", () => {
    assert.equal(
      usedUnitsForCode(
        { ...dsi, service_start_date: null },
        [sheet("DSI", "2026-08-01T15:00:00Z", "2026-08-01T16:00:00Z")],
        [],
      ).usedUnits,
      0,
    );
  });
});

describe("worstUnitsLeft", () => {
  it("picks the code with the smallest share left and skips pending or unitless codes", () => {
    const sei = { ...dsi, service_code: "SEI", annual_unit_authorization: 8 };
    const pending = {
      ...dsi,
      service_code: "SLN",
      annual_unit_authorization: 1,
      authorization_pending: true,
    };
    const none = { ...dsi, service_code: "COM", annual_unit_authorization: 0 };
    const rows = [sheet("SEI", "2026-08-01T15:00:00Z", "2026-08-01T16:00:00Z")]; // 4 of 8 used
    const w = worstUnitsLeft([dsi, sei, pending, none], rows, []);
    assert.deepEqual(w, { code: "SEI", left: 4, annual: 8, pct: 50 });
    assert.equal(worstUnitsLeft([pending, none], rows, []), null);
  });
});
