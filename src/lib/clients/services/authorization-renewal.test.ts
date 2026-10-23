import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizationSaveTarget, pastPeriods, renewProblems } from "./authorization-renewal.ts";
import { inputFromRow, type AuthorizationRow } from "./authorizations.ts";

const row = (over: Partial<AuthorizationRow> = {}): AuthorizationRow => ({
  id: "a1",
  service_code: "DSI",
  unit_type: "Q",
  rate_per_unit: 5,
  annual_unit_authorization: 1000,
  monthly_max_units: null,
  service_start_date: "2025-07-01",
  service_end_date: "2026-06-30",
  authorization_number: "OLD-1",
  authorization_approved_on: "2025-06-20",
  authorization_pending: false,
  rate_source: null,
  ...over,
});
const TODAY = "2026-10-07";

describe("renewing an authorization", () => {
  it("the renewal form starts blank: no old dates, units or 1056 number carried over", () => {
    const input = inputFromRow(row(), true);
    assert.equal(input.start, null);
    assert.equal(input.end, null);
    assert.equal(input.authorizationNumber, "");
    assert.equal(input.approvedOn, null);
    assert.equal(input.annualUnits, null);
    assert.equal(input.code, "DSI");
  });

  it("adding a code with an ended row renews it as a new period", () => {
    const t = authorizationSaveTarget([row()], null, { code: "dsi", start: "2026-07-01" }, TODAY);
    assert.deepEqual(t, { kind: "renew", id: "a1" });
  });

  it("a renewal must start after the old one ended, so the old dates stay distinct", () => {
    const t = authorizationSaveTarget([row()], null, { code: "DSI", start: "2026-06-30" }, TODAY);
    assert.equal(t.kind, "error");
    assert.deepEqual(renewProblems(row(), { start: null }), ["A renewal needs its own start date."]);
    assert.deepEqual(renewProblems(row(), { start: "2026-07-01" }), []);
  });

  it("an open row can't be renewed; it must be edited or ended", () => {
    const open = row({ service_end_date: "2027-06-30" });
    const t = authorizationSaveTarget([open], null, { code: "DSI", start: "2027-07-01" }, TODAY);
    assert.equal(t.kind, "error");
  });

  it("editing updates its own row; a new code inserts", () => {
    assert.deepEqual(authorizationSaveTarget([row()], "a1", { code: "DSI", start: null }, TODAY), {
      kind: "update",
      id: "a1",
    });
    assert.deepEqual(authorizationSaveTarget([row()], null, { code: "SLN", start: null }, TODAY), {
      kind: "insert",
    });
  });
});

describe("pastPeriods", () => {
  it("lists the renewed-away period with its own dates and 1056 number", () => {
    const current = row({ service_start_date: "2026-07-01", service_end_date: "2027-06-30" });
    const past = pastPeriods([current], {
      a1: [
        {
          id: "h2",
          billing_code_id: "a1",
          effective_start: "2025-07-01",
          effective_end: "2026-06-30",
          authorization_number: "OLD-1",
          authorization_approved_on: "2025-06-20",
          annual_unit_authorization: 1000,
          superseded_at: "2026-07-02T00:00:00Z",
        },
        {
          id: "h1",
          billing_code_id: "a1",
          effective_start: "2025-07-01",
          effective_end: null,
          authorization_number: "OLD-1",
          superseded_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "h0",
          billing_code_id: "a1",
          effective_start: "2026-07-01",
          effective_end: "2027-06-30",
          superseded_at: "2026-08-01T00:00:00Z",
        },
      ],
    });
    assert.equal(past.length, 1);
    assert.deepEqual(past[0], {
      key: "a1|2025-07-01",
      code: "DSI",
      start: "2025-07-01",
      end: "2026-06-30",
      authorizationNumber: "OLD-1",
      approvedOn: "2025-06-20",
      annualUnits: 1000,
    });
  });
});
