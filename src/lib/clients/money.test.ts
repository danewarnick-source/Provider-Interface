import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canVerifyPbaSample,
  formatMoney,
  moneySectionApplies,
  moneyTotal,
  pbaHeadroomPercent,
  pbaNeedsReceipt,
  pbaTone,
  quarterStart,
} from "./money.ts";

const none = { codes: [], pbaAccounts: 0, loans: 0, spending: 0 };

describe("moneySectionApplies", () => {
  it("is off with no PBA, loans or spending", () => {
    assert.equal(moneySectionApplies(none), false);
    assert.equal(moneySectionApplies({ ...none, codes: ["SLH", "DSI"] }), false);
  });
  it("is on for a PBA code, an account, a loan or spending", () => {
    assert.equal(moneySectionApplies({ ...none, codes: [" pba "] }), true);
    assert.equal(moneySectionApplies({ ...none, pbaAccounts: 1 }), true);
    assert.equal(moneySectionApplies({ ...none, loans: 2 }), true);
    assert.equal(moneySectionApplies({ ...none, spending: 1 }), true);
  });
});

describe("PBA limit", () => {
  it("tones by ratio of the Medicaid limit", () => {
    assert.equal(pbaTone(100, 2000), "healthy");
    assert.equal(pbaTone(1500, 2000), "watch");
    assert.equal(pbaTone(1800, 2000), "near_limit");
    assert.equal(pbaTone(500, 0), "healthy");
  });
  it("headroom is a clamped whole percent", () => {
    assert.equal(pbaHeadroomPercent(500, 2000), 75);
    assert.equal(pbaHeadroomPercent(2500, 2000), 0);
    assert.equal(pbaHeadroomPercent(10, 0), 0);
  });
  it("receipts over $50", () => {
    assert.equal(pbaNeedsReceipt(50), false);
    assert.equal(pbaNeedsReceipt(50.01), true);
  });
});

describe("quarterStart", () => {
  it("uses the local calendar quarter", () => {
    assert.equal(quarterStart(new Date(2026, 0, 1)), "2026-01-01");
    assert.equal(quarterStart(new Date(2026, 5, 30)), "2026-04-01");
    assert.equal(quarterStart(new Date(2026, 9, 6)), "2026-10-01");
    assert.equal(quarterStart(new Date(2026, 11, 31, 23, 59)), "2026-10-01");
  });
});

describe("audit and totals", () => {
  it("the account opener can't verify", () => {
    assert.equal(canVerifyPbaSample("u1", "u1"), false);
    assert.equal(canVerifyPbaSample("u1", "u2"), true);
    assert.equal(canVerifyPbaSample(null, "u2"), true);
  });
  it("sums to the cent", () => {
    assert.equal(moneyTotal([{ amount: 0.1 }, { amount: "0.2" }, { amount: null }]), 0.3);
    assert.equal(formatMoney(12.5), "$12.50");
  });
});
