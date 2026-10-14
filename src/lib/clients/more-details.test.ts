import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHIVED_FIELD_SUFFIX,
  customFieldLabel,
  hasCustomValue,
  moreDetailsFields,
} from "./more-details.ts";

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

const val = (v: Partial<NonNullable<Parameters<typeof hasCustomValue>[0]>>) => ({
  value_text: null,
  value_number: null,
  value_boolean: null,
  value_date: null,
  ...v,
});

describe("archived fields", () => {
  const fields = [
    { field_key: "pharmacy", archived: false, value: null },
    { field_key: "old_with_value", archived: true, value: val({ value_text: "Kept" }) },
    { field_key: "old_empty", archived: true, value: null },
    { field_key: "old_false", archived: true, value: val({ value_boolean: false }) },
  ];
  it("out of edit mode, an archived field shows only where the client has a value", () => {
    assert.deepEqual(
      moreDetailsFields(fields).map((f) => f.field_key),
      ["pharmacy", "old_with_value", "old_false"],
    );
  });
  it("edit mode lists every archived field so it can be restored", () => {
    assert.equal(moreDetailsFields(fields, { editing: true }).length, 4);
  });
  it("hasCustomValue ignores blanks and keeps 0 / false", () => {
    assert.equal(hasCustomValue(null), false);
    assert.equal(hasCustomValue(val({ value_text: "  " })), false);
    assert.equal(hasCustomValue(val({ value_number: 0 })), true);
    assert.equal(hasCustomValue(val({ value_boolean: false })), true);
    assert.equal(hasCustomValue(val({ value_date: "2026-01-02" })), true);
  });
  it("labels archived fields", () => {
    assert.equal(customFieldLabel({ field_label: "Pharmacy" }), "Pharmacy");
    assert.equal(
      customFieldLabel({ field_label: "Pharmacy", archived: true }),
      `Pharmacy${ARCHIVED_FIELD_SUFFIX}`,
    );
  });
});
