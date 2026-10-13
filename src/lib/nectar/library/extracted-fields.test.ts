import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractedFieldRows } from "./extracted-fields.ts";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("extractedFieldRows", () => {
  it("makes proposed rows with nulls for anything missing", () => {
    assert.deepEqual(extractedFieldRows(ORG, DOC, [{ field_key: "fiscal_year", value_text: "FY27" }]), [
      {
        organization_id: ORG,
        document_id: DOC,
        field_key: "fiscal_year",
        field_group: null,
        value_text: "FY27",
        value_number: null,
        value_date: null,
        value_json: null,
        source_locator: null,
        confidence: null,
        status: "proposed",
      },
    ]);
  });

  it("folds value_bool and value_array into value_json (the table has no such columns)", () => {
    const [row] = extractedFieldRows(ORG, DOC, [
      { field_key: "k", value_json: { a: 1 }, value_bool: false, value_array: ["x", "y"] },
    ]);
    assert.deepEqual(row.value_json, { a: 1, bool: false, array: ["x", "y"] });
    const [plain] = extractedFieldRows(ORG, DOC, [{ field_key: "k", value_bool: null, value_array: [] }]);
    assert.equal(plain.value_json, null);
  });
});
