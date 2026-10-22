// Saving and renewing authorizations. A client has one client_billing_codes
// row per code (UNIQUE organization_id, client_id, service_code; the 1056
// import upserts on it), so renewing an ended code reuses that row for the
// new period. Before the row changes, a database trigger copies the old
// period (rate, dates, 1056 number, approved date, units) into
// client_billing_code_rate_history, so nothing about the old authorization
// is lost. These rules make sure a renewal is a NEW period: it needs its own
// start date after the old one ended. Pure; no Supabase.

import {
  authorizationState,
  normalizeCode,
  type AuthorizationInput,
  type AuthorizationRow,
} from "./authorizations.ts";
import { formatDate } from "./dates.ts";

type Existing = Pick<
  AuthorizationRow,
  "id" | "service_code" | "service_start_date" | "service_end_date" | "authorization_pending"
>;

export type SaveTarget =
  | { kind: "insert" }
  | { kind: "update"; id: string }
  | { kind: "renew"; id: string }
  | { kind: "error"; message: string };

/** Problems with renewing `old` (an ended authorization) as `input`. */
export function renewProblems(
  old: Pick<AuthorizationRow, "service_end_date">,
  input: Pick<AuthorizationInput, "start">,
): string[] {
  const oldEnd = old.service_end_date?.slice(0, 10) ?? null;
  if (!input.start) return ["A renewal needs its own start date."];
  if (oldEnd && input.start <= oldEnd)
    return [`The renewal must start after the old authorization ended (${formatDate(oldEnd)}).`];
  return [];
}

/**
 * What saving `input` does. `id` is the row being edited (null = add or
 * renew). Adding a code the client already has: an ended row is renewed
 * (new period, old one kept in history); an open row must be edited or ended.
 */
export function authorizationSaveTarget(
  existing: readonly Existing[],
  id: string | null,
  input: Pick<AuthorizationInput, "code" | "start">,
  today: string,
): SaveTarget {
  const code = normalizeCode(input.code);
  const sameCode = existing.find((r) => normalizeCode(r.service_code) === code && r.id !== id);
  if (id) {
    if (sameCode)
      return { kind: "error", message: `${code} already has an authorization row for this client.` };
    return { kind: "update", id };
  }
  if (!sameCode) return { kind: "insert" };
  if (authorizationState(sameCode, today) !== "ended")
    return {
      kind: "error",
      message: `${code} already has an open authorization. Edit it, or End it first.`,
    };
  const problems = renewProblems(sameCode, input);
  if (problems.length) return { kind: "error", message: problems.join(" ") };
  return { kind: "renew", id: sameCode.id };
}

export type HistoryPeriod = {
  id: string;
  billing_code_id: string;
  effective_start: string | null;
  effective_end: string | null;
  authorization_number?: string | null;
  authorization_approved_on?: string | null;
  annual_unit_authorization?: number | null;
  superseded_at: string;
};

export type PastAuthorization = {
  key: string;
  code: string;
  start: string | null;
  end: string | null;
  authorizationNumber: string | null;
  approvedOn: string | null;
  annualUnits: number | null;
};

/**
 * Earlier authorization periods of each code, from history: a history entry
 * whose start date differs from the row's current start is a period that
 * was renewed away. History is newest first, so the first entry for a
 * period is its last state. Newest period first.
 */
export function pastPeriods(
  rows: readonly Pick<AuthorizationRow, "id" | "service_code" | "service_start_date">[],
  history: Record<string, readonly HistoryPeriod[]>,
): PastAuthorization[] {
  const out: PastAuthorization[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const current = r.service_start_date?.slice(0, 10) ?? null;
    for (const h of history[r.id] ?? []) {
      const start = h.effective_start?.slice(0, 10) ?? null;
      if (start === current) continue;
      const key = `${r.id}|${start ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        code: normalizeCode(r.service_code),
        start,
        end: h.effective_end?.slice(0, 10) ?? null,
        authorizationNumber: h.authorization_number ?? null,
        approvedOn: h.authorization_approved_on ?? null,
        annualUnits: h.annual_unit_authorization ?? null,
      });
    }
  }
  return out.sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""));
}
