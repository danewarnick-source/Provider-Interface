import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describesActivity } from "./note-activity.ts";

describe("describesActivity", () => {
  it("is false for notes made only of filler", () => {
    for (const note of [
      "",
      "good shift",
      "n/a",
      "N/A.",
      "nothing to report",
      "No issues. Client was fine.",
      "same as usual",
      "OK",
      "Quiet night, no concerns",
      "Everything went... well? no, fine!",
      "had a good day",
    ]) {
      assert.equal(describesActivity(note), false, JSON.stringify(note));
    }
  });

  it("is true once any word describes something that happened", () => {
    for (const note of [
      "park, soda $2, calm all shift",
      "watched tv",
      "Staff prompted laundry folding",
      "slept",
      "went to the store",
    ]) {
      assert.equal(describesActivity(note), true, JSON.stringify(note));
    }
  });
});
