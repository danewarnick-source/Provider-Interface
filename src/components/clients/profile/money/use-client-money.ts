// Money data for one client: whether the Money section applies (PBA code or
// account, loans, spending), the PBA account, this quarter's audit sample and
// the spending log. Reads go through RLS (PBA: owner or agency admin; loans:
// owner; spending: org members).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { moneySectionApplies, quarterStart } from "@/lib/clients/money";

export type PbaAccount = {
  id: string;
  client_id: string;
  current_balance: number;
  medicaid_threshold: number;
  opened_on: string;
  notes: string | null;
  created_by: string | null;
};

export type PbaAuditSample = {
  id: string;
  account_id: string;
  status: "pending" | "verified";
  verified_at: string | null;
  verifier_notes: string | null;
};

const count = async (table: "pba_accounts" | "client_loans" | "client_spending_log", clientId: string) => {
  const { count: n, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  return error ? 0 : (n ?? 0);
};

export function useClientMoneyPresence(
  orgId: string | undefined,
  clientId: string,
  codes: readonly string[],
  enabled: boolean,
) {
  return useQuery({
    enabled: enabled && !!orgId,
    queryKey: ["client-money-presence", orgId, clientId],
    staleTime: 60_000,
    queryFn: async () => {
      const [pbaAccounts, loans, spending] = await Promise.all([
        count("pba_accounts", clientId),
        count("client_loans", clientId),
        count("client_spending_log", clientId),
      ]);
      return { pbaAccounts, loans, spending };
    },
    select: (p) => moneySectionApplies({ ...p, codes }),
  });
}

export const pbaAccountKey = (orgId: string, clientId: string) => ["client-pba", orgId, clientId];

export function useClientPba(orgId: string, clientId: string) {
  return useQuery({
    queryKey: pbaAccountKey(orgId, clientId),
    queryFn: async (): Promise<{ account: PbaAccount | null; sample: PbaAuditSample | null }> => {
      const { data, error } = await supabase
        .from("pba_accounts")
        .select("id, client_id, current_balance, medicaid_threshold, opened_on, notes, created_by")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .order("opened_on", { ascending: false })
        .limit(1);
      if (error) throw error;
      const account = ((data ?? [])[0] as PbaAccount | undefined) ?? null;
      if (!account) return { account: null, sample: null };
      const { data: s, error: sErr } = await supabase
        .from("pba_audit_samples")
        .select("id, account_id, status, verified_at, verifier_notes")
        .eq("organization_id", orgId)
        .eq("account_id", account.id)
        .eq("quarter", quarterStart())
        .limit(1);
      if (sErr) throw sErr;
      return { account, sample: ((s ?? [])[0] as PbaAuditSample | undefined) ?? null };
    },
  });
}
