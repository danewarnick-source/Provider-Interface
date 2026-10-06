import { isVariableRateCode } from "./variable-rate-codes.ts";

/**
 * Advisory checks on a client's 1056 authorization rows. Read-only: these
 * describe what is on file and never invent dates, units or rates.
 */
export type AuthAlertKind = "needs_1056" | "expired" | "expiring" | "units_low" | "units_exhausted";

export type AuthAlert = { kind: AuthAlertKind; severity: "warn" | "critical"; message: string };

export const UNITS_LOW_PCT = 85;
export const EXPIRING_DAYS = 30;

export type AuthRowInput = {
  service_code: string;
  authorization_pending?: boolean | null;
  annual_unit_authorization?: number | null;
  rate_per_unit?: number | string | null;
  service_end_date?: string | null;
};

/**
 * Placeholder rows (Add Client creates them at 0 units / $0) aren't real
 * authorizations yet. Table-rate codes (SLH, SLN, …) legitimately carry $0
 * on the row, so only per-client worksheet codes need a rate.
 */
export function needs1056Numbers(row: AuthRowInput): boolean {
  if (row.authorization_pending) return true;
  if (Number(row.annual_unit_authorization ?? 0) <= 0) return true;
  return isVariableRateCode(row.service_code) && Number(row.rate_per_unit ?? 0) <= 0;
}

function daysUntil(ymd: string, today: Date): number | null {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const end = new Date(y, m - 1, d);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end.getTime() - t.getTime()) / 86_400_000);
}

export function authorizationAlerts(
  row: AuthRowInput,
  usedPct: number | null,
  today: Date = new Date(),
): AuthAlert[] {
  const code = row.service_code.trim().toUpperCase() || "Code";
  const out: AuthAlert[] = [];

  if (needs1056Numbers(row)) {
    out.push({
      kind: "needs_1056",
      severity: "critical",
      message: `${code} needs 1056 numbers. Enter the real units and rate from the 1056.`,
    });
  }

  const days = row.service_end_date ? daysUntil(row.service_end_date, today) : null;
  if (days !== null && days < 0) {
    out.push({
      kind: "expired",
      severity: "critical",
      message: `${code} expired ${row.service_end_date}. Enter the renewal 1056 — don't invent an end date.`,
    });
  } else if (days !== null && days <= EXPIRING_DAYS) {
    out.push({
      kind: "expiring",
      severity: "warn",
      message: `${code} ends ${row.service_end_date} (${days} day${days === 1 ? "" : "s"}). Request the renewal 1056.`,
    });
  }

  if (usedPct != null && !needs1056Numbers(row)) {
    if (usedPct >= 100) {
      out.push({
        kind: "units_exhausted",
        severity: "critical",
        message: `${code} has used all authorized units.`,
      });
    } else if (usedPct >= UNITS_LOW_PCT) {
      out.push({
        kind: "units_low",
        severity: "warn",
        message: `${code} has used ${Math.round(usedPct)}% of authorized units.`,
      });
    }
  }
  return out;
}
