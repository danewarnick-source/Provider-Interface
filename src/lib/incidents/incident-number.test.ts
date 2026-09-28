import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  insertIncidentNumbered,
  isUniqueConflict,
  nextIncidentReportNumber,
} from "./incident-number.ts";

describe("incident report numbers (service-role max+1)", () => {
  it("uses the highest number in the org, not a count of visible rows", () => {
    const existing = ["IR-2026-0001", "IR-2026-0004", "IR-2025-0099", "note"];
    assert.equal(nextIncidentReportNumber(existing, 2026), "IR-2026-0005");
    assert.equal(nextIncidentReportNumber([], 2026), "IR-2026-0001");
  });

  it("retries only on a unique conflict", async () => {
    const seen = ["IR-2026-0002"];
    const attempts: string[] = [];
    const row = await insertIncidentNumbered({
      year: 2026,
      listNumbers: async () => seen.slice(),
      insert: async (reportNumber) => {
        attempts.push(reportNumber);
        if (attempts.length === 1) {
          seen.push(reportNumber);
          return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        }
        return { data: { id: "new", report_number: reportNumber }, error: null };
      },
    });
    assert.deepEqual(attempts, ["IR-2026-0003", "IR-2026-0004"]);
    assert.equal(row.report_number, "IR-2026-0004");
    assert.equal(isUniqueConflict({ code: "23505" }), true);
    assert.equal(isUniqueConflict({ message: "permission denied" }), false);
  });

  it("does not retry a non-unique insert error", async () => {
    await assert.rejects(
      () =>
        insertIncidentNumbered({
          year: 2026,
          listNumbers: async () => [],
          insert: async () => ({ data: null, error: { code: "42501", message: "permission denied" } }),
        }),
      /permission denied/,
    );
  });
});
