// Loan ledger math and display rules. Pure, importable by node --test.
//
// Loans and ledger entries are never deleted (7-year Medicaid retention); they
// are voided with a reason. A voided entry stays on the ledger, struck through
// with its reason, and never counts toward the balance.

export type VoidableRow = { voided_at?: string | null; void_reason?: string | null };

export type LedgerEntry = VoidableRow & {
  id?: string;
  entry_date?: string | null;
  kind: string;
  amount: number | string | null;
  note?: string | null;
};

export const VOID_REASON_MIN = 3;
export const VOID_REASON_MAX = 500;

export function isVoided(row: VoidableRow | null | undefined): boolean {
  return !!row?.voided_at;
}

/** Entries that count toward the balance (not voided). */
export function activeEntries<T extends VoidableRow>(entries: readonly T[]): T[] {
  return entries.filter((e) => !isVoided(e));
}

/**
 * Balance owed: advances and direct payments add, repayments subtract,
 * adjustments carry their sign. Voided entries are skipped.
 */
export function computeRunningBalance(entries: readonly LedgerEntry[]): number {
  let bal = 0;
  for (const e of activeEntries(entries)) {
    const a = Number(e.amount ?? 0);
    if (!Number.isFinite(a)) continue;
    if (e.kind === "advance" || e.kind === "direct_payment") bal += a;
    else if (e.kind === "repayment") bal -= a;
    else bal += a;
  }
  return Math.round(bal * 100) / 100;
}

/** A void reason, trimmed; throws when missing or too short. */
export function cleanVoidReason(reason: string | null | undefined): string {
  const r = (reason ?? "").trim();
  if (r.length < VOID_REASON_MIN) throw new Error("Give a reason for voiding (at least 3 characters).");
  return r.slice(0, VOID_REASON_MAX);
}

export type LedgerLine = {
  date: string;
  kind: string;
  amount: string;
  note: string;
  voided: boolean;
  voidReason: string | null;
};

/** Every entry, oldest first, ready to list (voided ones flagged for strike-through). */
export function ledgerLines(entries: readonly LedgerEntry[]): LedgerLine[] {
  return [...entries]
    .sort((a, b) => String(a.entry_date ?? "").localeCompare(String(b.entry_date ?? "")))
    .map((e) => ({
      date: String(e.entry_date ?? ""),
      kind: e.kind.replace(/_/g, " "),
      amount: `$${Number(e.amount ?? 0).toFixed(2)}`,
      note: e.note ?? "",
      voided: isVoided(e),
      voidReason: isVoided(e) ? (e.void_reason ?? "") : null,
    }));
}
