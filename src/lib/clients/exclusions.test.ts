import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXCLUSION_REASON_MAX,
  cleanExclusionReason,
  exclusionAssignRefusal,
  exclusionRefusal,
  findExclusion,
  openExcludedShifts,
  type StaffExclusion,
} from "./exclusions.ts";

const list: StaffExclusion[] = [
  { client_id: "c1", staff_user_id: "s1", reason: "Family request" },
  { client_id: "c2", staff_user_id: "s2", reason: "  " },
];

describe("findExclusion", () => {
  it("matches only the exact client + team member", () => {
    assert.equal(findExclusion(list, "c1", "s1")?.reason, "Family request");
    assert.equal(findExclusion(list, "c1", "s2"), null);
    assert.equal(findExclusion(list, "c2", "s1"), null);
    assert.equal(findExclusion([], "c1", "s1"), null);
  });
});

describe("refusal messages", () => {
  it("says who, which client and why", () => {
    assert.equal(
      exclusionRefusal("Pat Example", "Sam Sample", " Family request "),
      "You can't schedule this — Pat Example is on Sam Sample's do-not-schedule list: Family request.",
    );
  });
  it("leaves out an empty reason", () => {
    assert.equal(
      exclusionRefusal("Pat", "Sam", "  "),
      "You can't schedule this — Pat is on Sam's do-not-schedule list.",
    );
    assert.match(exclusionAssignRefusal("Family request"), /do-not-schedule list: Family request\. End that first\./);
  });
});

describe("openExcludedShifts", () => {
  it("drops excluded staff to open shifts and counts them", () => {
    const rows = [
      { client_id: "c1", staff_id: "s1", n: 1 },
      { client_id: "c1", staff_id: "s3", n: 2 },
      { client_id: "c1", staff_id: null, n: 3 },
      { client_id: "c2", staff_id: "s1", n: 4 },
    ];
    const r = openExcludedShifts(rows, list);
    assert.equal(r.opened, 1);
    assert.deepEqual(
      r.rows.map((x) => x.staff_id),
      [null, "s3", null, "s1"],
    );
    assert.equal(r.rows[0].n, 1);
    assert.equal(rows[0].staff_id, "s1", "input rows are not changed");
  });
});

describe("cleanExclusionReason", () => {
  it("needs a reason, trimmed and not too long", () => {
    assert.deepEqual(cleanExclusionReason("  Too far away "), { ok: true, value: "Too far away" });
    assert.equal(cleanExclusionReason("   ").ok, false);
    assert.equal(cleanExclusionReason("x".repeat(EXCLUSION_REASON_MAX + 1)).ok, false);
  });
});
