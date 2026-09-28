import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { incidentInvolvesClientOr, incidentVisibleForCaseload } from "./incident-visibility.ts";

const primary = "11111111-1111-1111-1111-111111111111";
const extra = "22222222-2222-2222-2222-222222222222";

describe("incidents with additional clients", () => {
  it("includes an incident when the additional client is on caseload", () => {
    const row = { client_id: primary, additional_client_ids: [extra] };
    assert.equal(incidentVisibleForCaseload(row, new Set([extra])), true);
    assert.equal(incidentVisibleForCaseload(row, new Set([primary])), true);
    assert.equal(incidentVisibleForCaseload(row, new Set(["33333333-3333-3333-3333-333333333333"])), false);
  });

  it("asks PostgREST for the primary client or additional_client_ids", () => {
    const filter = incidentInvolvesClientOr(extra);
    assert.match(filter, new RegExp(`client_id\\.eq\\.${extra}`));
    assert.match(filter, /additional_client_ids\.cs/);
  });
});
