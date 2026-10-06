import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizationProblems,
  authorizationState,
  authorizationValues,
  authorizationView,
  endProblems,
  isYmd,
  servicesTotals,
  sortAuthorizations,
  type AuthorizationInput,
  type AuthorizationRow,
} from "./authorizations.ts";

const row = (over: Partial<AuthorizationRow> = {}): AuthorizationRow => ({
  id: "a1",
  service_code: "DSI",
  unit_type: "Q",
  rate_per_unit: 5,
  annual_unit_authorization: 1000,
  monthly_max_units: null,
  service_start_date: "2026-07-01",
  service_end_date: "2027-06-30",
  authorization_number: "100200",
  authorization_approved_on: "2026-06-20",
  authorization_pending: false,
  rate_source: null,
  ...over,
});

const at = (ymd: string) => new Date(`${ymd}T12:00:00`);

describe("authorizationState", () => {
  it("ends on the end date (same rule as active codes)", () => {
    assert.equal(authorizationState(row(), "2027-06-29"), "current");
    assert.equal(authorizationState(row(), "2027-06-30"), "ended");
  });
  it("marks pending and upcoming rows", () => {
    assert.equal(authorizationState(row({ authorization_pending: true }), "2026-08-01"), "pending");
    assert.equal(authorizationState(row(), "2026-06-01"), "upcoming");
  });
});

describe("authorizationView: units used vs left and pace", () => {
  it("works out units left, dollars and the pace marker", () => {
    const v = authorizationView(row(), 250, at("2026-10-01"));
    assert.equal(v.pace.left, 750);
    assert.equal(v.pace.usedPct, 25);
    assert.ok(v.pace.elapsedPct > 24 && v.pace.elapsedPct < 26);
    assert.deepEqual(v.money, { authorized: 5000, used: 1250, left: 3750 });
    assert.equal(v.unitWord, "units");
  });
  it("gives units per week to use the rest by the end date", () => {
    const v = authorizationView(row({ annual_unit_authorization: 364, service_start_date: "2026-07-01", service_end_date: "2027-06-29" }), 0, at("2026-07-01"));
    assert.ok(v.perWeekToUseRest !== null && Math.abs(v.perWeekToUseRest - 7) < 0.01);
    assert.equal(v.runsOutOn, null);
  });
  it("projects a run-out date when usage is ahead of pace", () => {
    const v = authorizationView(row(), 900, at("2026-10-01"));
    assert.ok(v.runsOutOn && v.runsOutOn < "2027-06-30");
  });
  it("has no dollars without a rate and counts days for daily codes", () => {
    const v = authorizationView(row({ service_code: "HHS", unit_type: "day", rate_per_unit: 0 }), 10, at("2026-10-01"));
    assert.equal(v.money, null);
    assert.equal(v.unitWord, "days");
  });
  it("never shows negative units left when over-used", () => {
    const v = authorizationView(row(), 1200, at("2026-10-01"));
    assert.equal(v.pace.left, 0);
    assert.equal(v.money?.left, 0);
  });
});

describe("totals and sorting", () => {
  it("adds up dollars for authorizations that aren't ended", () => {
    const now = at("2026-10-01");
    const views = [
      authorizationView(row(), 100, now),
      authorizationView(row({ id: "b", service_code: "SEI", service_end_date: "2026-09-01" }), 0, now),
    ];
    assert.deepEqual(servicesTotals(views), { authorized: 5000, used: 500, left: 4500 });
    assert.deepEqual(sortAuthorizations(views).map((v) => v.row.id), ["a1", "b"]);
  });
});

describe("authorizationProblems: 1056 field validation", () => {
  const ok: AuthorizationInput = {
    code: "dsi", unitType: "Q", rate: 5.25, annualUnits: 1200, start: "2026-07-01", end: "2027-06-30",
    authorizationNumber: "100200", approvedOn: "2026-06-20",
  };
  it("accepts a clean line", () => {
    assert.deepEqual(authorizationProblems(ok, ["DSI", "SEI"]), []);
  });
  it("refuses codes the agency isn't approved for", () => {
    assert.match(authorizationProblems({ ...ok, code: "COM" }, ["DSI"])[0], /approved codes/);
    assert.deepEqual(authorizationProblems({ ...ok, code: "COM" }, []), []);
  });
  it("needs whole-number units", () => {
    assert.ok(authorizationProblems({ ...ok, annualUnits: 12.5 }, []).some((p) => /whole number/.test(p)));
  });
  it("needs real dates with the end after the start", () => {
    assert.ok(authorizationProblems({ ...ok, start: "2026-02-30" }, []).some((p) => /start date/.test(p)));
    assert.ok(authorizationProblems({ ...ok, end: "2026-07-01" }, []).some((p) => /after the start/.test(p)));
    assert.ok(authorizationProblems({ ...ok, approvedOn: "06/20/2026" }, []).some((p) => /approved date/.test(p)));
  });
  it("checks the unit type against daily codes", () => {
    assert.ok(authorizationProblems({ ...ok, code: "HHS", unitType: "Q" }, []).some((p) => /by the day/.test(p)));
    assert.deepEqual(authorizationProblems({ ...ok, code: "HHS", unitType: "day" }, []), []);
  });
  it("builds clean values", () => {
    const v = authorizationValues(ok);
    assert.equal(v.service_code, "DSI");
    assert.equal(v.authorization_pending, false);
    assert.equal(v.authorization_number, "100200");
  });
});

describe("endProblems and isYmd", () => {
  it("refuses an end before the start", () => {
    assert.deepEqual(endProblems(row(), "2026-07-01"), []);
    assert.equal(endProblems(row(), "2026-06-30").length, 1);
    assert.equal(endProblems(row(), "nope").length, 1);
  });
  it("only takes real calendar dates", () => {
    assert.equal(isYmd("2028-02-29"), true);
    assert.equal(isYmd("2027-02-29"), false);
  });
});
