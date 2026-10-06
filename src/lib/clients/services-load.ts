// Server-side assembly of one client's Services & billing: every
// authorization row (current and ended), units used per row (units.ts),
// pace and dollars (authorizations.ts), rate history, and the agency's
// approved codes. Runs with the caller's RLS-scoped client; called only from
// services.functions.ts.

import { fetchTenantIdentity } from "@/lib/service-classification";
import { loadUsage, rows, type AuthRow, type Sb } from "./list-queries";
import {
  authorizationView,
  servicesTotals,
  sortAuthorizations,
  type AuthorizationRow,
  type AuthorizationView,
  type Money,
} from "./authorizations";
import { usedUnitsForCode } from "./units";

export type RateHistoryEntry = {
  id: string;
  billing_code_id: string;
  rate_per_unit: number;
  unit_type: string;
  effective_start: string | null;
  effective_end: string | null;
  rate_source: string | null;
  superseded_at: string;
};

export type ClientServices = {
  authorizations: AuthorizationView[];
  totals: Money;
  /** Earlier versions of each authorization row, newest first, keyed by row id. */
  history: Record<string, RateHistoryEntry[]>;
  /** The agency's approved codes; [] when none are set up (codes then aren't checked). */
  agencyCodes: string[];
};

const AUTH_COLUMNS =
  "id, client_id, service_code, unit_type, rate_per_unit, annual_unit_authorization, monthly_max_units, service_start_date, service_end_date, authorization_number, authorization_approved_on, authorization_pending, rate_source";

export async function loadAuthorizationRows(
  sb: Sb,
  orgId: string,
  clientId: string,
): Promise<AuthorizationRow[]> {
  return rows<AuthorizationRow>(
    sb
      .from("client_billing_codes")
      .select(AUTH_COLUMNS)
      .eq("organization_id", orgId)
      .eq("client_id", clientId),
  );
}

export async function loadAgencyCodes(sb: Sb, orgId: string): Promise<string[]> {
  return (await fetchTenantIdentity(sb, orgId)).codesHeld;
}

export async function loadClientServices(
  sb: Sb,
  orgId: string,
  clientId: string,
  now: Date = new Date(),
): Promise<ClientServices> {
  const [auths, agencyCodes, historyRows] = await Promise.all([
    loadAuthorizationRows(sb, orgId, clientId),
    loadAgencyCodes(sb, orgId),
    rows<RateHistoryEntry>(
      sb
        .from("client_billing_code_rate_history")
        .select(
          "id, billing_code_id, rate_per_unit, unit_type, effective_start, effective_end, rate_source, superseded_at",
        )
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .order("superseded_at", { ascending: false }),
    ).catch(() => [] as RateHistoryEntry[]),
  ]);
  const usageRows = auths.map((a) => ({ ...a, client_id: clientId }) as unknown as AuthRow);
  const usage = await loadUsage(sb, orgId, [clientId], usageRows);
  const views = sortAuthorizations(
    auths.map((a) =>
      authorizationView(a, usedUnitsForCode(a, usage.sheets, usage.days).usedUnits, now),
    ),
  );
  const history: Record<string, RateHistoryEntry[]> = {};
  for (const h of historyRows) (history[h.billing_code_id] ??= []).push(h);
  return { authorizations: views, totals: servicesTotals(views), history, agencyCodes };
}
