import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSamePageGate } from "./route-gate.ts";

const g = globalThis as { window?: unknown };

describe("createSamePageGate", () => {
  it("skips only a search-params-only change (stay + same pathname)", () => {
    g.window = {};
    try {
      const gate = createSamePageGate();
      assert.equal(gate.skip("enter", "/dashboard/team-members"), false);
      // ?filter=… on the same page
      assert.equal(gate.skip("stay", "/dashboard/team-members"), true);
      assert.equal(gate.skip("stay", "/dashboard/team-members"), true);
      // Root / layout routes are "stay" across pages: a new pathname still checks.
      assert.equal(gate.skip("stay", "/dashboard/billing"), false);
      assert.equal(gate.skip("stay", "/dashboard/team-members"), false);
      // enter always checks, even on the same pathname
      assert.equal(gate.skip("enter", "/dashboard/team-members"), false);
    } finally {
      delete g.window;
    }
  });

  it("preloads never skip and never move the recorded page", () => {
    g.window = {};
    try {
      const gate = createSamePageGate();
      gate.skip("enter", "/dashboard");
      assert.equal(gate.skip("preload", "/dashboard/billing"), false);
      assert.equal(gate.skip("stay", "/dashboard/billing"), false);
      gate.skip("enter", "/dashboard");
      gate.skip("preload", "/dashboard/billing");
      assert.equal(gate.skip("stay", "/dashboard"), true);
    } finally {
      delete g.window;
    }
  });

  it("never skips on the server", () => {
    const gate = createSamePageGate();
    assert.equal(gate.skip("enter", "/dashboard"), false);
    assert.equal(gate.skip("stay", "/dashboard"), false);
  });
});
