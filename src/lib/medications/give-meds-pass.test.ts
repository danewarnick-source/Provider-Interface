import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { denverWallToIso } from "../denver-date.ts";
import {
  PassInput,
  administratorRole,
  buildDosePayload,
  doseErrorMessage,
  isHandsOn,
  passProblem,
  recordedIn,
  type PassMed,
} from "./give-meds-pass.ts";

const NOW = new Date(denverWallToIso("2026-10-14", 9, 0));
const DUE = denverWallToIso("2026-10-14", 8, 0);
const med = (over: Partial<PassMed> = {}): PassMed => ({
  id: "11111111-1111-4111-8111-111111111111",
  medication_name: "Sertraline",
  scheduled_times: ["08:00"],
  is_prn: false,
  is_active: true,
  how_taken: "self",
  ...over,
});
const input = (over: Record<string, unknown> = {}) =>
  PassInput.parse({
    clientId: "22222222-2222-4222-8222-222222222222",
    medicationId: "11111111-1111-4111-8111-111111111111",
    scheduledFor: DUE,
    scheduledTimeLabel: "08:00",
    outcome: "given",
    route: "By mouth",
    actualTakenAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
    clientRequestId: "33333333-3333-4333-8333-333333333333",
    ...over,
  });

describe("PassInput", () => {
  it("requires a request id on every dose", () => {
    assert.throws(() => PassInput.parse({ ...input(), clientRequestId: undefined }));
  });
});

describe("who gives it comes from how_taken", () => {
  it("maps self, assist and nurse", () => {
    assert.equal(administratorRole("self", null), "staff_observed");
    assert.equal(administratorRole(null, null), "staff_observed");
    assert.equal(administratorRole("assist", null), "staff_administered");
    assert.equal(administratorRole("nurse", "rn"), "rn");
    assert.throws(() => administratorRole("nurse", null), /nurse role/);
    assert.equal(isHandsOn("staff_observed"), false);
    assert.equal(isHandsOn("staff_administered"), true);
  });
});

describe("passProblem", () => {
  it("accepts a scheduled dose given now", () => {
    assert.equal(passProblem(input(), med(), NOW), null);
  });

  it("refuses a time not on the medication's schedule", () => {
    const wrong = denverWallToIso("2026-10-14", 9, 0);
    assert.match(passProblem(input({ scheduledFor: wrong }), med(), NOW) ?? "", /scheduled times/);
  });

  it("refuses future and stale times taken", () => {
    const future = new Date(NOW.getTime() + 10 * 60_000).toISOString();
    assert.match(passProblem(input({ actualTakenAt: future }), med(), NOW) ?? "", /future/);
  });

  it("PRN needs a reason and can't be logged as not given", () => {
    const prn = med({ is_prn: true, scheduled_times: [] });
    const base = input({ scheduledFor: null });
    assert.match(passProblem(base, prn, NOW) ?? "", /why the as-needed/);
    assert.equal(passProblem({ ...base, prnReason: "headache" }, prn, NOW), null);
    assert.match(
      passProblem({ ...base, outcome: "not_given", notGivenReason: "refused" }, prn, NOW) ?? "",
      /only logged when/,
    );
  });

  it("controlled doses need counts before and after; rescue needs seizure details", () => {
    assert.match(passProblem(input(), med({ is_controlled: true }), NOW) ?? "", /before and after/);
    assert.equal(
      passProblem(input({ countBefore: 10, countAfter: 9 }), med({ is_controlled: true }), NOW),
      null,
    );
    assert.match(passProblem(input(), med({ is_rescue: true }), NOW) ?? "", /seizure/);
  });

  it("not given needs a reason", () => {
    assert.match(passProblem(input({ outcome: "not_given" }), med(), NOW) ?? "", /Pick why/);
    assert.equal(
      passProblem(input({ outcome: "not_given", notGivenReason: "asleep" }), med(), NOW),
      null,
    );
  });
});

describe("buildDosePayload", () => {
  it("sends the route, the time taken, the request id and counts, never an expected count", () => {
    const p = buildDosePayload({
      input: input({
        countBefore: 10,
        countAfter: 9,
        witnessConfirmationId: "44444444-4444-4444-8444-444444444444",
      }),
      med: med({ is_controlled: true, how_taken: "assist" }),
      role: "staff_administered",
      fullName: "Pat Lee",
      nowIso: NOW.toISOString(),
    });
    assert.equal(p.status, "administered");
    assert.equal(p.route, "By mouth");
    assert.equal(p.actual_taken_at, p.administered_at);
    assert.equal(p.client_request_id, "33333333-3333-4333-8333-333333333333");
    assert.equal(p.count_before, 10);
    assert.equal(p.count_after, 9);
    assert.equal(p.witness_confirmation_id, "44444444-4444-4444-8444-444444444444");
    assert.equal("expected_count" in p, false);
    assert.equal("second_witness_id" in p, false);
    assert.match(String(p.signature_attestation), /^Pat Lee @/);
  });

  it("a PRN is stamped at the time taken; a dose not given has no time taken", () => {
    const prn = buildDosePayload({
      input: input({ scheduledFor: null, prnReason: "pain" }),
      med: med({ is_prn: true, scheduled_times: [] }),
      role: "staff_observed",
      fullName: "Pat",
      nowIso: NOW.toISOString(),
    });
    assert.equal(prn.scheduled_for, prn.actual_taken_at);
    const missed = buildDosePayload({
      input: input({ outcome: "not_given", notGivenReason: "not_home" }),
      med: med(),
      role: "staff_observed",
      fullName: "Pat",
      nowIso: NOW.toISOString(),
    });
    assert.equal(missed.status, "omitted");
    assert.equal(missed.exception_reason, "Not home");
    assert.equal(missed.actual_taken_at, null);
  });

  it("names the service context and turns database errors into plain English", () => {
    assert.equal(recordedIn("HHS"), "hhs");
    assert.equal(recordedIn("DSI"), "dsi");
    assert.equal(recordedIn("SLH"), "general");
    assert.match(doseErrorMessage("PRN_LIMIT: too soon"), /Add a reason/);
    assert.equal(doseErrorMessage("TRAINING: Not approved."), "Not approved.");
  });
});
