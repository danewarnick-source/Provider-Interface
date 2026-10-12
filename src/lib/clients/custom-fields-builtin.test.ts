import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBuiltInField, isPlaceholderField, withBuiltInFields } from "./custom-fields-builtin.ts";

const field = (id: string, key: string, text: string | null = null) => ({
  id,
  field_key: key,
  field_label: key,
  data_type: "text" as const,
  section: "identity" as const,
  value: text == null ? null : ({ value_text: text } as never),
});

describe("withBuiltInFields", () => {
  it("adds a Primary language placeholder when the agency has no definition", () => {
    const out = withBuiltInFields([field("a", "pharmacy")]);
    assert.deepEqual(out.map((f) => f.field_key), ["primary_language", "pharmacy"]);
    assert.equal(isPlaceholderField(out[0]), true);
    assert.equal(out[0].field_label, "Primary language");
  });
  it("uses the existing definition first, once", () => {
    const out = withBuiltInFields([field("a", "pharmacy"), field("b", "primary_language", "Spanish")]);
    assert.deepEqual(out.map((f) => f.id), ["b", "a"]);
    assert.equal(isPlaceholderField(out[0]), false);
    assert.equal(isBuiltInField(out[0]), true);
    assert.equal(isBuiltInField(out[1]), false);
  });
});
