import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLIENT_EDIT_TARGETS, profileSearch } from "./profile-search.ts";

describe("client profile search", () => {
  it("keeps each editor target", () => {
    for (const edit of CLIENT_EDIT_TARGETS) {
      assert.deepEqual(profileSearch.parse({ section: "profile", edit }), {
        section: "profile",
        edit,
      });
    }
    assert.deepEqual([...CLIENT_EDIT_TARGETS], ["home", "codes", "units", "team"]);
  });
  it("ignores an unknown or malformed edit and keeps the rest", () => {
    assert.deepEqual(profileSearch.parse({ section: "services", edit: "photo" }), {
      section: "services",
      edit: undefined,
    });
    assert.equal(profileSearch.parse({ edit: 3 }).edit, undefined);
    assert.equal(profileSearch.parse({}).edit, undefined);
  });
  it("still ignores an unknown section", () => {
    assert.equal(profileSearch.parse({ section: "nope", edit: "home" }).section, undefined);
    assert.equal(profileSearch.parse({ section: "nope", edit: "home" }).edit, "home");
  });
});
