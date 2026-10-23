import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absenceDays,
  absenceProblem,
  directivePatch,
  directiveStatus,
  medicationSupportSummary,
  showsAbsences,
} from "./health.ts";

describe("advance directive", () => {
  it("reads stored status, including older free text", () => {
    assert.equal(directiveStatus(null), null);
    assert.equal(directiveStatus("DNR"), "dnr");
    assert.equal(directiveStatus("Do not resuscitate on file"), "dnr");
    assert.equal(directiveStatus("POLST form"), "polst");
    assert.equal(directiveStatus("None"), "none");
  });
  it("saves status, location, palliative/hospice and notes; DNR/POLST need the document", () => {
    assert.deepEqual(
      directivePatch({ status: "polst", location: " Fridge ", palliative: "", hospice: "Enrolled", notes: "" }),
      {
        dnr_status: "POLST",
        dnr_applicable: true,
        dnr_location: "Fridge",
        polst_status: "POLST",
        palliative_care_status: null,
        hospice_status: "Enrolled",
        advance_directive_notes: null,
      },
    );
    const none = directivePatch({ status: "none", location: "Fridge", palliative: "", hospice: "", notes: "x" });
    assert.equal(none.dnr_applicable, false);
    assert.equal(none.dnr_location, null);
    assert.equal(none.dnr_status, "None");
  });
});

describe("health helpers", () => {
  it("summarizes how the client takes their medications", () => {
    assert.equal(
      medicationSupportSummary([{ how_taken: "assist" }, { how_taken: "self" }, { how_taken: "assist" }]),
      "Staff help with 2 · On their own with 1 · Nurse gives 0",
    );
    assert.equal(medicationSupportSummary([]), "Staff help with 0 · On their own with 0 · Nurse gives 0");
  });
  it("shows absences for RHS clients only", () => {
    assert.equal(showsAbsences(["rhs", "DSI"]), true);
    assert.equal(showsAbsences(["HHS"]), false);
  });
  it("counts absence days and checks dates", () => {
    assert.equal(absenceDays("2026-10-01", "2026-10-03"), 3);
    assert.equal(absenceDays("2026-10-01", null), null);
    assert.equal(absenceProblem("2026-10-03", "2026-10-01"), "The return date can't be before the first day away.");
    assert.equal(absenceProblem("", null), "Pick the first day away.");
    assert.equal(absenceProblem("2026-10-01", null), null);
  });
});
