import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANY_MED_BAD_REACTION,
  MEDICATION_REFERENCE,
  getReference,
  referenceKey,
  searchMedications,
} from "./reference.ts";

describe("medication reference", () => {
  it("loads the built-in list with unique keys", () => {
    assert.ok(MEDICATION_REFERENCE.length >= 200);
    const keys = new Set(MEDICATION_REFERENCE.map((m) => m.key));
    assert.equal(keys.size, MEDICATION_REFERENCE.length);
    assert.match(ANY_MED_BAD_REACTION, /911/);
  });

  it("'ser' returns Sertraline and Quetiapine (Seroquel), generic match first", () => {
    const names = searchMedications("ser").map((m) => m.name);
    assert.ok(names.includes("Sertraline"));
    assert.ok(names.includes("Quetiapine"));
    assert.ok(names.indexOf("Sertraline") < names.indexOf("Quetiapine"));
  });

  it("'kepp' returns Levetiracetam (Keppra), case-insensitive", () => {
    assert.equal(searchMedications("KEPP")[0]?.name, "Levetiracetam");
  });

  it("puts start matches before contains matches and respects the limit", () => {
    const list = [
      { ...MEDICATION_REFERENCE[0], key: "a", name: "Xalpha", brands: [] },
      { ...MEDICATION_REFERENCE[0], key: "b", name: "Alphax", brands: [] },
      { ...MEDICATION_REFERENCE[0], key: "c", name: "Zeta", brands: ["Alphabrand"] },
    ];
    assert.deepEqual(
      searchMedications("alpha", 8, list).map((m) => m.key),
      ["b", "c", "a"],
    );
    assert.equal(searchMedications("alpha", 1, list).length, 1);
    assert.deepEqual(searchMedications("   ", 8, list), []);
  });

  it("getReference finds an entry by key; psychotropic falls back to the secondary use", () => {
    const lamotrigine = getReference(referenceKey("Lamotrigine"));
    assert.equal(lamotrigine?.name, "Lamotrigine");
    assert.equal(lamotrigine?.psychotropic, "mood stabilizer");
    assert.equal(getReference("not-a-med"), null);
    assert.equal(getReference(null), null);
    assert.equal(referenceKey(" Divalproex sodium "), "divalproex-sodium");
  });
});
