// Money section of the client profile: the PBA ledger (pba_accounts /
// pba_transactions / pba_audit_samples), loans (client_loans) and the
// spending log (client_spending_log). Pure — importable by node --test.

/** PBA = Personal Budget Assistance, the service code that brings a ledger. */
export const PBA_CODE = "PBA";

/** Receipts are required on PBA transactions over this many dollars. */
export const PBA_RECEIPT_OVER = 50;

export const PBA_TXN_TYPES = [
  { value: "deposit", label: "Deposit" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "transfer", label: "Transfer" },
  { value: "interest", label: "Interest" },
  { value: "debt", label: "Outstanding debt" },
  { value: "split_cost", label: "Split-cost" },
] as const;

export type MoneyPresence = {
  codes: readonly string[];
  pbaAccounts: number;
  loans: number;
  spending: number;
};

/** Money shows only for clients with PBA (code or account), loans, or spending. */
export function moneySectionApplies(p: MoneyPresence): boolean {
  return (
    p.codes.some((c) => c.trim().toUpperCase() === PBA_CODE) ||
    p.pbaAccounts > 0 ||
    p.loans > 0 ||
    p.spending > 0
  );
}

export type PbaTone = "healthy" | "watch" | "near_limit";

/** How close the balance is to the Medicaid limit: 75% watch, 90% near the limit. */
export function pbaTone(balance: number, threshold: number): PbaTone {
  const ratio = threshold > 0 ? balance / threshold : 0;
  if (ratio >= 0.9) return "near_limit";
  if (ratio >= 0.75) return "watch";
  return "healthy";
}

/** Percent of the limit still free (0–100, whole number). */
export function pbaHeadroomPercent(balance: number, threshold: number): number {
  if (!(threshold > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - balance / threshold) * 100)));
}

export function pbaNeedsReceipt(amount: number): boolean {
  return amount > PBA_RECEIPT_OVER;
}

/** First day (YYYY-MM-DD) of the calendar quarter holding this local date. */
export function quarterStart(d: Date = new Date()): string {
  const month = Math.floor(d.getMonth() / 3) * 3 + 1;
  return `${d.getFullYear()}-${String(month).padStart(2, "0")}-01`;
}

/** The person who opened an account can't verify its own audit sample. */
export function canVerifyPbaSample(accountOpenedBy: string | null, viewerId: string): boolean {
  return !accountOpenedBy || accountOpenedBy !== viewerId;
}

/** Sum of amounts, to the cent. */
export function moneyTotal(rows: readonly { amount: number | string | null }[]): number {
  const cents = rows.reduce((s, r) => s + Math.round(Number(r.amount ?? 0) * 100), 0);
  return cents / 100;
}

/** Spending dated in the same calendar month as `now` (local time). */
export function spentThisMonth(
  rows: readonly { amount: number | string | null; spent_at: string }[],
  now: Date = new Date(),
): number {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return moneyTotal(rows.filter((r) => localMonth(r.spent_at) === month));
}

function localMonth(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const CLOSED_LOAN = new Set(["closed", "paid", "paid_off", "repaid", "void", "cancelled", "canceled"]);

/** A loan still open (drafts count: the agreement is on file, not settled). */
export function isOpenLoan(status: string | null | undefined): boolean {
  return !CLOSED_LOAN.has((status ?? "").trim().toLowerCase());
}

export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}
