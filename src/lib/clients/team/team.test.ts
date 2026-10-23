import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readinessTag, teamCards, teamOnCode } from "./team.ts";

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

describe("team on a code", () => {
  const assigned = new Map([
    ["m", ["SLN", "DSI"]],
    ["d", ["sln "]],
    ["x", ["SLN"]],
    ["h", ["SLH"]],
    ["e", []],
  ]);
  const active = [
    { id: "m", name: "Maria Lopez" },
    { id: "d", name: "Devin Park" },
    { id: "h", name: "Hana Ito" },
    { id: "e", name: "Eli Stone" },
  ];

  it("only active team members whose codes list it, by name", () => {
    assert.deepEqual(
      teamOnCode(assigned, active, "SLN").map((s) => s.name),
      ["Devin Park", "Maria Lopez"],
    );
  });

  it("separated team members (not in the active list) and empty codes never count", () => {
    assert.ok(!teamOnCode(assigned, active, "SLN").some((s) => s.id === "x"));
    assert.deepEqual(teamOnCode(assigned, active, "HHS"), []);
    assert.deepEqual(teamOnCode(assigned, active, " "), []);
  });

  it("matches the code however it is cased", () => {
    assert.deepEqual(
      teamOnCode(assigned, active, "slh").map((s) => s.id),
      ["h"],
    );
  });
});
