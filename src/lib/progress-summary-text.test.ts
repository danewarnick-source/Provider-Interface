import assert from "node:assert/strict";
import { test } from "node:test";
import { summaryText } from "./progress-summary-text.ts";

test("summary text: header, general summary, each goal with its progress or the no-documentation line", () => {
  const text = summaryText({
    clientName: "Pat Example",
    provider: "Example Supports",
    supportCoordinator: "Casey Sample",
    summary: { service_codes: ["DSI", "HHS"], period_start: "2026-07-01", period_end: "2026-09-30" },
    general: "  A steady quarter. ",
    goalDrafts: { g1: "Cooked pasta twice." },
    goals: [
      { id: "g1", goal: "Pat will cook a meal." },
      { id: "g2", goal: "Pat will ride the bus." },
    ],
  });
  assert.equal(
    text,
    [
      "PERSON: Pat Example",
      "SERVICES PROVIDED THIS PERIOD: DSI, HHS",
      "DATE RANGE: 2026-07-01 to 2026-09-30",
      "PROVIDER: Example Supports",
      "SUPPORT COORDINATOR: Casey Sample",
      "",
      "GENERAL SUMMARY",
      "A steady quarter.",
      "",
      "GOAL PROGRESS",
      "Goal: Pat will cook a meal.",
      "Cooked pasta twice.",
      "",
      "Goal: Pat will ride the bus.",
      "No documentation in this period supports progress on this goal.",
      "",
    ].join("\n"),
  );
});
