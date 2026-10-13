import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankEligibility, type EligibilityInputs } from "./eligibility.ts";

const start = new Date("2026-10-14T15:00:00Z");
const end = new Date("2026-10-14T17:00:00Z");

function person(over: Partial<EligibilityInputs["staff"][number]> = {}): EligibilityInputs["staff"][number] {
  return {
    id: "s1", full_name: "Maria Example", active: true, date_of_birth: "1990-01-01", weeklyShifts: [],
    activeCertKeys: new Set(), assignedToClient: true, isHostForLocation: false, ...over,
  };
}

function rank(code: string, staff: EligibilityInputs["staff"]) {
  return rankEligibility({
    serviceCode: code, shiftStart: start, shiftEnd: end, staff, clientId: "c1",
    requiredCertKeys: [], overtimeThresholdHours: 40,
  });
}

describe("rankEligibility minimum age (Decision 4)", () => {
  it("a 16-year-old is eligible for ordinary codes", () => {
    const r = rank("SLH", [person({ date_of_birth: "2010-06-01" })]);
    assert.deepEqual(r[0]!.blockers, []);
  });

  it("a 15-year-old is blocked", () => {
    const r = rank("SLH", [person({ date_of_birth: "2011-06-01" })]);
    assert.match(r[0]!.blockers.join(" "), /16\+/);
  });

  it("HHS and PPS need 21", () => {
    assert.match(rank("HHS", [person({ date_of_birth: "2006-06-01" })])[0]!.blockers.join(" "), /21\+/);
    assert.match(rank("PPS", [person({ date_of_birth: "2006-06-01" })])[0]!.blockers.join(" "), /21\+/);
    assert.deepEqual(rank("HHS", [person({ date_of_birth: "2005-06-01" })])[0]!.blockers, []);
  });

  it("unknown date of birth warns only when the floor is above 18", () => {
    assert.deepEqual(rank("SLH", [person({ date_of_birth: null })])[0]!.warnings, []);
    assert.match(rank("HHS", [person({ date_of_birth: null })])[0]!.warnings.join(" "), /DOB unknown/);
  });
});

describe("rankEligibility other checks", () => {
  it("inactive and already-scheduled staff are blocked, hosts are excluded", () => {
    assert.match(rank("SLH", [person({ active: false })])[0]!.blockers.join(" "), /Inactive/);
    const busy = person({ weeklyShifts: [{ id: "x", starts_at: "2026-10-14T16:00:00Z", ends_at: "2026-10-14T18:00:00Z" }] });
    assert.match(rank("SLH", [busy])[0]!.blockers.join(" "), /Already scheduled/);
    const host = rank("SLH", [person({ isHostForLocation: true })])[0]!;
    assert.equal(host.blocked, true);
  });

  it("ranks an assigned, clean person above an unassigned one", () => {
    const r = rank("SLH", [person({ id: "a", assignedToClient: false }), person({ id: "b" })]);
    assert.equal(r[0]!.staffId, "b");
  });

  it("missing certs warn and overtime warns", () => {
    const r = rankEligibility({
      serviceCode: "SLH", shiftStart: start, shiftEnd: end, staff: [person()], clientId: "c1",
      requiredCertKeys: ["cpr-fa"], overtimeThresholdHours: 1,
    });
    assert.match(r[0]!.warnings.join(" "), /Missing or expired cert: cpr-fa/);
    assert.match(r[0]!.warnings.join(" "), /OT/);
  });
});
