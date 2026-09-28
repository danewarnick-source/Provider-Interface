import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { legacyProfileSearch, legacyRosterSearch } from "./legacy-links.ts";

describe("legacyRosterSearch", () => {
  it("turns every old ?upload spelling into ?import=1", () => {
    for (const upload of [true, 1, "1", "true"]) {
      assert.deepEqual(legacyRosterSearch({ upload }), { import: 1 }, String(upload));
    }
  });

  it("drops anything else", () => {
    for (const search of [
      {},
      { upload: false },
      { upload: 0 },
      { upload: "0" },
      { upload: "yes" },
    ]) {
      assert.deepEqual(legacyRosterSearch(search), {});
    }
    assert.deepEqual(legacyRosterSearch(undefined), {});
    assert.deepEqual(legacyRosterSearch(null), {});
    assert.deepEqual(legacyRosterSearch({ tab: "record" }), {});
  });
});

describe("legacyProfileSearch", () => {
  it("maps the old file tabs onto ?tab=file", () => {
    for (const tab of ["record", "obligations", "staff", "personnel"]) {
      assert.deepEqual(legacyProfileSearch({ tab }), { tab: "file" }, tab);
    }
  });

  it("maps permissions onto profile and keeps profile and activity", () => {
    assert.deepEqual(legacyProfileSearch({ tab: "permissions" }), { tab: "profile" });
    assert.deepEqual(legacyProfileSearch({ tab: "profile" }), { tab: "profile" });
    assert.deepEqual(legacyProfileSearch({ tab: "activity" }), { tab: "activity" });
  });

  it("drops unknown, non-string, and prototype-named tabs", () => {
    assert.deepEqual(legacyProfileSearch({ tab: "caseload" }), {});
    assert.deepEqual(legacyProfileSearch({ tab: "constructor" }), {});
    assert.deepEqual(legacyProfileSearch({ tab: 1 }), {});
    assert.deepEqual(legacyProfileSearch({}), {});
    assert.deepEqual(legacyProfileSearch(undefined), {});
    assert.deepEqual(legacyProfileSearch(null), {});
  });
});
