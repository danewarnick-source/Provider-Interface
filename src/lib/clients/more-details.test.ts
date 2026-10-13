import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moreDetailsFields } from "./more-details.ts";

describe("moreDetailsFields", () => {
  it("leaves out Primary language and keeps the agency's fields in order", () => {
    const out = moreDetailsFields([
      { field_key: "pharmacy" },
      { field_key: "primary_language" },
      { field_key: "shoe_size" },
    ]);
    assert.deepEqual(
      out.map((f) => f.field_key),
      ["pharmacy", "shoe_size"],
    );
  });
  it("returns nothing for no fields", () => {
    assert.deepEqual(moreDetailsFields([]), []);
  });
});
