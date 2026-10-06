import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignmentChanges, staffMissingCodes } from "./team.ts";

describe("assignmentChanges", () => {
  const original = new Map([
    ["a", ["SLH", "DSI"]],
    ["b", ["SLH"]],
  ]);
  it("is clean when nothing changed (order doesn't matter)", () => {
    const r = assignmentChanges(
      original,
      new Map([
        ["a", ["DSI", "SLH"]],
        ["b", ["SLH"]],
      ]),
    );
    assert.deepEqual(r, { writes: [], dirty: false });
  });
  it("writes adds, changes and removals ([] removes)", () => {
    const r = assignmentChanges(
      original,
      new Map([
        ["a", ["SLH"]],
        ["c", ["DSI"]],
      ]),
    );
    assert.deepEqual(r.writes, [
      ["a", ["SLH"]],
      ["c", ["DSI"]],
      ["b", []],
    ]);
    assert.equal(r.dirty, true);
  });
});

describe("staffMissingCodes", () => {
  it("lists checked team members with no codes", () => {
    assert.deepEqual(
      staffMissingCodes(
        new Map([
          ["a", []],
          ["b", ["SLH"]],
        ]),
      ),
      ["a"],
    );
  });
});
