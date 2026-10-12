// Money data for one client: whether the Money section applies (PBA code or
// account, loans, spending), the PBA account, this quarter's audit sample and
// the spending log. Reads go through RLS (PBA: owner or agency admin; loans:
// owner; spending: org members).

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getLoanFeatureStatus, listClientLoans } from "@/lib/clients/loans.functions";
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

const count = async (
  table: "pba_accounts" | "client_loans" | "client_spending_log",
  clientId: string,
) => {
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

export type SpendRow = {
  id: string;
  amount: number;
  purpose: string | null;
  spent_at: string;
  staff_id: string | null;
  receipt_path: string | null;
  notes: string | null;
};

const SPENDING_LIMIT = 200;

/** The spending log, newest first (the last 200 entries). */
export function useClientSpending(orgId: string, clientId: string) {
  return useQuery({
    queryKey: ["client-spending", orgId, clientId],
    queryFn: async (): Promise<SpendRow[]> => {
      const { data, error } = await supabase
        .from("client_spending_log")
        .select("id, amount, purpose, spent_at, staff_id, receipt_path, notes")
        .eq("organization_id", orgId)
        .eq("client_id", clientId)
        .order("spent_at", { ascending: false })
        .limit(SPENDING_LIMIT);
      if (error) throw error;
      return (data ?? []) as SpendRow[];
    },
  });
}

export type LoanRow = { id: string; borrower_name: string; agreement_date: string; status: string };

/** Loan agreements (owners only): whether loan records are on, and the client's loans. */
export function useClientLoans(orgId: string, clientId: string, isOwner: boolean) {
  const statusFn = useServerFn(getLoanFeatureStatus);
  const listFn = useServerFn(listClientLoans);
  const status = useQuery({
    enabled: isOwner,
    queryKey: ["loan-feature-status", orgId],
    queryFn: () => statusFn({ data: { organization_id: orgId } }),
  });
  const enabled = isOwner && status.data?.enabled === true;
  const loans = useQuery({
    enabled,
    queryKey: ["loans", orgId, "client", clientId],
    queryFn: async () =>
      (await listFn({ data: { organization_id: orgId, client_id: clientId } })) as LoanRow[],
  });
  return { status, loans, enabled };
}
