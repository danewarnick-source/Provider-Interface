import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localYmd } from "./local-date.ts";

describe("localYmd", () => {
  it("uses local calendar fields, not UTC", () => {
    assert.equal(localYmd(new Date(2026, 6, 1, 23, 30)), "2026-07-01");
    assert.equal(localYmd(new Date(2026, 0, 9, 0, 5)), "2026-01-09");
  });
});
