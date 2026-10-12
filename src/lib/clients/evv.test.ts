import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientEvvCodes, evvAddressNote } from "./evv.ts";

describe("clientEvvCodes", () => {
  it("keeps only EVV-mandated codes, sorted, without repeats", () => {
    assert.deepEqual(clientEvvCodes(["sln", "DSI", "SLH", "SLN", null, "HHS"]), ["SLH", "SLN"]);
    assert.deepEqual(clientEvvCodes(["SEI", "RHS", "HHS", "DSI"]), []);
  });
});

describe("evvAddressNote", () => {
  it("says EVV is required and lists the codes", () => {
    const n = evvAddressNote(["SLH", "DSI"]);
    assert.equal(n.required, true);
    assert.equal(n.tag, "EVV required: SLH");
    assert.match(n.text, /^Staff on SLH must clock in inside the circle\./);
  });
  it("says the pin is optional when no code uses EVV", () => {
    const n = evvAddressNote(["DSI"]);
    assert.equal(n.required, false);
    assert.equal(n.tag, "No EVV codes");
    assert.match(n.text, /The pin is optional/);
  });
});
