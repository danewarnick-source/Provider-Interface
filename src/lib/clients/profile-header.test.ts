import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  goesByLine,
  guardianTile,
  headerReadiness,
  maskId,
  planYearTile,
  preferredNameFrom,
} from "./profile-header.ts";

const fmt = (ymd: string) => `F(${ymd})`;

describe("goesByLine", () => {
  it("joins preferred name, age and home", () => {
    assert.equal(
      goesByLine({ preferredName: "Sam", firstName: "Samuel", age: 34, home: "Maple House" }),
      "Goes by Sam · Age 34 · Maple House",
    );
  });
  it("leaves out blanks and a preferred name equal to the first name", () => {
    assert.equal(goesByLine({ preferredName: "sam", firstName: "Sam", age: null, home: " " }), "");
    assert.equal(
      goesByLine({ preferredName: null, firstName: "Sam", age: 0, home: null }),
      "Age 0",
    );
  });
});

describe("preferredNameFrom", () => {
  it("reads the preferred_name custom field", () => {
    assert.equal(
      preferredNameFrom([
        { field_key: "pronouns", value: { value_text: "they" } },
        { field_key: "preferred_name", value: { value_text: "  Sam " } },
      ]),
      "Sam",
    );
  });
  it("is null when missing or blank", () => {
    assert.equal(preferredNameFrom(undefined), null);
    assert.equal(preferredNameFrom([{ field_key: "preferred_name", value: null }]), null);
    assert.equal(
      preferredNameFrom([{ field_key: "preferred_name", value: { value_text: "" } }]),
      null,
    );
  });
});

describe("headerReadiness", () => {
  it("is null while loading", () => {
    assert.equal(headerReadiness(null), null);
  });
  it("counts only the setup gaps", () => {
    const r = headerReadiness([
      { key: "setup:No team member assigned", detail: "No team member assigned" },
      { key: "photo", detail: "Add a current photo" },
      { key: "setup:Guardian not on file", detail: "Guardian not on file" },
    ]);
    assert.deepEqual(r, {
      ready: false,
      missing: ["No team member assigned", "Guardian not on file"],
    });
  });
  it("is ready with no setup gaps", () => {
    assert.deepEqual(headerReadiness([{ key: "photo", detail: "x" }]), {
      ready: true,
      missing: [],
    });
  });
});

describe("guardianTile", () => {
  it("prefers own guardian", () => {
    assert.deepEqual(guardianTile(true, { name: "Pat", relationship: "Mother" }), {
      value: "Own guardian",
      missing: false,
    });
  });
  it("shows name and relationship", () => {
    assert.equal(
      guardianTile(false, { name: "Pat Example", relationship: "Mother" }).value,
      "Pat Example (Mother)",
    );
    assert.equal(
      guardianTile(null, { name: "Pat Example", relationship: null }).value,
      "Pat Example",
    );
  });
  it("flags a missing guardian", () => {
    assert.deepEqual(guardianTile(false, null), { value: "Not on file", missing: true });
  });
});

describe("planYearTile", () => {
  it("shows the end date when current", () => {
    assert.deepEqual(planYearTile("2027-08-31", { kind: "ok", endDate: "2027-08-31", days: 300 }, fmt), {
      value: "F(2027-08-31)",
      note: null,
      warn: false,
    });
  });
  it("uses the PCSP wording when it expires soon or is overdue", () => {
    const soon = planYearTile(
      "2026-11-05",
      { kind: "expiring", endDate: "2026-11-05", days: 30, threshold: 30 },
      fmt,
    );
    assert.deepEqual(soon, { value: "F(2026-11-05)", note: "PCSP expires in 30 days (Nov 5)", warn: false });
    assert.deepEqual(
      planYearTile("2026-08-31", { kind: "overdue", endDate: "2026-08-31", days: 12, followUp: true }, fmt),
      { value: "F(2026-08-31)", note: "PCSP is 12 days overdue", warn: true },
    );
    assert.equal(
      planYearTile("2026-08-31", { kind: "overdue", endDate: "2026-08-31", days: 1, followUp: false }, fmt).note,
      "PCSP is 1 day overdue",
    );
  });
  it("warns when there is no PCSP", () => {
    assert.deepEqual(planYearTile(null, { kind: "none" }, fmt), {
      value: "No PCSP on file",
      note: null,
      warn: true,
    });
  });
});

describe("maskId", () => {
  it("hides all but the last four characters", () => {
    assert.equal(maskId("0012345678"), "•••• 5678");
    assert.equal(maskId(" 123 "), "123");
    assert.equal(maskId(""), null);
    assert.equal(maskId(null), null);
  });
});
