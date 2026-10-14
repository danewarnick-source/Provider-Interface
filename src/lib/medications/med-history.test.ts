import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeChanges } from "./med-history.ts";

describe("describeChanges", () => {
  it("writes each field change in plain English", () => {
    assert.deepEqual(
      describeChanges({
        dosage: { from: "1 tablet", to: "2 tablets" },
        medication_name: { from: null, to: "Sertraline" },
        scheduled_times: { from: ["08:00"], to: ["08:00", "20:00"] },
        how_taken: { from: "self", to: "assist" },
        choking_risk: { from: false, to: true },
        bsp_document_id: { from: null, to: "x" },
        label_photo_path: {
          from: null,
          to: "o/c/medications/label-11111111-1111-1111-1111-111111111111-bottle.jpg",
        },
        sent_to: { from: null, to: "School" },
      }),
      [
        "Dose: 1 tablet → 2 tablets",
        "Name: Sertraline",
        "Times: 8:00 AM → 8:00 AM, 8:00 PM",
        "How they take it: Takes it on their own with staff watching → Staff help (prompt, open, hand it over)",
        "Swallowing or choking risk: no → yes",
        "Behavior support plan: set",
        "Label photo: bottle.jpg",
        "Sent to: School",
      ],
    );
  });

  it("ignores junk", () => {
    assert.deepEqual(describeChanges(null), []);
    assert.deepEqual(describeChanges([1, 2]), []);
  });
});
