import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activeEntries,
  cleanVoidReason,
  computeRunningBalance,
  isVoided,
  ledgerLines,
} from "./loan-ledger.ts";

const VOID = "2026-10-01T12:00:00Z";
const entries = [
  { id: "a", entry_date: "2026-09-01", kind: "advance", amount: 100 },
  { id: "b", entry_date: "2026-09-02", kind: "direct_payment", amount: "50.5" },
  { id: "c", entry_date: "2026-09-03", kind: "repayment", amount: 20 },
  { id: "d", entry_date: "2026-09-04", kind: "adjustment", amount: -5 },
  { id: "e", entry_date: "2026-09-05", kind: "advance", amount: 999, voided_at: VOID, void_reason: "Typed twice" },
];

describe("computeRunningBalance", () => {
  it("adds advances and direct payments, subtracts repayments, signs adjustments", () => {
    assert.equal(computeRunningBalance(entries.slice(0, 4)), 125.5);
  });
  it("leaves voided entries out of the math", () => {
    assert.equal(computeRunningBalance(entries), 125.5);
    assert.equal(computeRunningBalance([entries[4]]), 0);
  });
  it("is zero for no entries", () => {
    assert.equal(computeRunningBalance([]), 0);
  });
});

describe("voids", () => {
  it("isVoided / activeEntries", () => {
    assert.equal(isVoided(entries[4]), true);
    assert.equal(isVoided(entries[0]), false);
    assert.equal(isVoided(null), false);
    assert.deepEqual(
      activeEntries(entries).map((e) => e.id),
      ["a", "b", "c", "d"],
    );
  });
  it("a void needs a real reason", () => {
    assert.throws(() => cleanVoidReason(""), /reason/);
    assert.throws(() => cleanVoidReason("  x "), /reason/);
    assert.equal(cleanVoidReason("  Entered in error "), "Entered in error");
  });
});

describe("ledgerLines", () => {
  it("still lists voided entries, flagged with their reason, oldest first", () => {
    const lines = ledgerLines([...entries].reverse());
    assert.equal(lines.length, 5);
    assert.equal(lines[0].date, "2026-09-01");
    const voided = lines.find((l) => l.voided);
    assert.ok(voided);
    assert.equal(voided.voidReason, "Typed twice");
    assert.equal(voided.amount, "$999.00");
    assert.equal(lines[1].kind, "direct payment");
    assert.equal(lines[0].voidReason, null);
  });
});

describe("wiring: nothing is deleted", () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const fns = read("./loans.functions.ts");
  const editor = read("../../../components/loans/loan-editor.tsx");
  const pdf = read("./loans-pdf.ts");
  it("loan server fns never delete and guard the client", () => {
    assert.doesNotMatch(fns, /\.delete\(\)/);
    assert.doesNotMatch(fns, /deleteLoan/);
    assert.match(fns, /export const voidLoan\b/);
    assert.match(fns, /export const voidLoanEntry\b/);
    assert.match(fns, /action: "edit_loans"/);
  });
  it("the editor voids instead of deleting and strikes voided rows", () => {
    assert.doesNotMatch(editor, /deleteLoan/);
    assert.match(editor, /voidLoanEntry/);
    assert.match(editor, /line-through/);
  });
  it("the PDF balance comes from the void-aware math and lists the ledger", () => {
    assert.match(pdf, /computeRunningBalance\(entries\)/);
    assert.match(pdf, /ledgerLines\(entries\)/);
  });
});
