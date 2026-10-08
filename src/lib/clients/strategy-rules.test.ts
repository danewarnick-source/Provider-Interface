import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bulletProblem,
  codeNeedsStrategy,
  formatBullets,
  parseBullets,
  personNeedsSupportStrategies,
  strategyNeed,
  strategyNeedText,
} from "./strategy-rules.ts";

describe("which codes need a support strategy (§1.24(5))", () => {
  it("exempts ELS, MTP, PBA, PM1/PM2 and respite", () => {
    for (const c of ["ELS", "MTP", "pba", "PM1", "PM2", "RP2", "RP3", "RP4", "RP5", "RL6", "RPS"]) {
      assert.equal(codeNeedsStrategy(c), false, c);
    }
    for (const c of ["SLH", "HHS", "DSI", "SEI", "SJD", "RHS"])
      assert.equal(codeNeedsStrategy(c), true, c);
  });

  it("points BC codes to the BSP and PN codes to the Medical Care Plan", () => {
    assert.deepEqual(strategyNeed(["BC1"]), { kind: "other_plan", plan: "BSP" });
    assert.equal(strategyNeedText(strategyNeed(["PN2"])), "Covered by the Medical Care Plan");
    assert.equal(strategyNeedText(strategyNeed(["MTP"])), "Not needed (§1.24(5))");
  });

  it("needs a strategy when any code of the support does", () => {
    assert.equal(strategyNeed(["MTP", "SLH"]).kind, "needed");
    assert.equal(strategyNeed([]).kind, "needed");
    assert.equal(strategyNeedText(strategyNeed(["SLH"])), "");
  });

  it("is the one list for the whole client", () => {
    assert.equal(personNeedsSupportStrategies(["MTP", "RP2"]), false);
    assert.equal(personNeedsSupportStrategies(["BC2"]), false);
    assert.equal(personNeedsSupportStrategies(["MTP", "HHS"]), true);
    assert.equal(personNeedsSupportStrategies([]), true);
  });
});

describe("bullets", () => {
  it("parses list markers and blank lines away, and formats as '- ' lines", () => {
    assert.deepEqual(parseBullets("- One\n\n• Two\n3. Three\n* Four"), [
      "One",
      "Two",
      "Three",
      "Four",
    ]);
    assert.deepEqual(parseBullets(null), []);
    assert.equal(formatBullets(["- A", " B ", ""]), "- A\n- B");
  });

  it("accepts 4–6 short bullets only", () => {
    const four = [
      "Staff offer two choices.",
      "Staff model the step.",
      "Staff wait.",
      "Staff praise.",
    ];
    assert.equal(bulletProblem(four), null);
    assert.match(bulletProblem(four.slice(0, 3))!, /4–6/);
    assert.match(bulletProblem([...four, ...four])!, /got 8/);
    assert.match(bulletProblem([...four.slice(0, 3), "  "])!, /empty/);
    assert.match(bulletProblem([...four.slice(0, 3), "word ".repeat(31)])!, /over 30 words/);
  });
});
