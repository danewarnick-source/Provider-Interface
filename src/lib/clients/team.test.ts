import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readinessTag, teamCards } from "./team.ts";

describe("team cards", () => {
  const assigned = new Map([
    ["b", ["DSI", "SLH"]],
    ["a", ["SLH"]],
  ]);
  const names = new Map([
    ["a", "Zoe Test"],
    ["b", "Amir Test"],
  ]);
  it("one card per team member, by name, codes in the client's order", () => {
    const cards = teamCards(
      assigned,
      names,
      [{ id: "b", readyAlone: true, readinessLabel: "Ready" }],
      ["SLH", "DSI"],
    );
    assert.deepEqual(
      cards.map((c) => [c.name, c.codes, c.readiness.label]),
      [
        ["Amir Test", ["SLH", "DSI"], "Ready alone"],
        ["Zoe Test", ["SLH"], "Readiness unknown"],
      ],
    );
  });
  it("tags readiness in plain words", () => {
    assert.equal(
      readinessTag({ id: "x", readyAlone: false, readinessLabel: "Not ready: CPR" }).label,
      "Training needed",
    );
    assert.equal(
      readinessTag({ id: "x", readyAlone: false, readinessLabel: "Readiness not available" }).tone,
      "neutral",
    );
  });
});
