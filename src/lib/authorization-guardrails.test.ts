import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizationAlerts, needs1056Numbers } from "./authorization-guardrails.ts";

const today = new Date(2026, 9, 6);
const kinds = (a: ReturnType<typeof authorizationAlerts>) => a.map((x) => x.kind);

describe("needs1056Numbers", () => {
  it("flags pending, zero-unit, and $0 worksheet-rate rows", () => {
    assert.equal(needs1056Numbers({ service_code: "DSI", authorization_pending: true, annual_unit_authorization: 400, rate_per_unit: 9 }), true);
    assert.equal(needs1056Numbers({ service_code: "SLH", annual_unit_authorization: 0, rate_per_unit: 0 }), true);
    assert.equal(needs1056Numbers({ service_code: "HHS", annual_unit_authorization: 365, rate_per_unit: "0.0000" }), true);
  });
  it("accepts $0 on table-rate codes", () => {
    assert.equal(needs1056Numbers({ service_code: "SLH", annual_unit_authorization: 5000, rate_per_unit: 0 }), false);
    assert.equal(needs1056Numbers({ service_code: "hhs", annual_unit_authorization: 365, rate_per_unit: 120 }), false);
  });
});

describe("authorizationAlerts", () => {
  const ok = { service_code: "DSI", annual_unit_authorization: 400, rate_per_unit: 9 };
  it("warns at 85% used and 30 days before end", () => {
    assert.deepEqual(kinds(authorizationAlerts({ ...ok, service_end_date: "2026-11-05" }, 85, today)), ["expiring", "units_low"]);
    assert.deepEqual(kinds(authorizationAlerts({ ...ok, service_end_date: "2026-11-06" }, 84, today)), []);
  });
  it("reports expired and exhausted", () => {
    assert.deepEqual(kinds(authorizationAlerts({ ...ok, service_end_date: "2026-10-05" }, 100, today)), ["expired", "units_exhausted"]);
  });
  it("doesn't pace placeholder rows", () => {
    assert.deepEqual(kinds(authorizationAlerts({ service_code: "HHS", annual_unit_authorization: 0, rate_per_unit: 0 }, 150, today)), ["needs_1056"]);
  });
});
