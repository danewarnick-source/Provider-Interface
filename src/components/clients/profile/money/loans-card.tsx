// Loan agreements on file for this client (owner only, like the rest of the
// loan records). Opens the shared loan editor. When the agency hasn't turned
// loan records on, points to the Client loans page where that's done.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HandCoins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { formatDate } from "@/lib/clients/dates";
import { LoanEditor } from "@/components/loans/loan-editor";
import { getLoanFeatureStatus, listClientLoans } from "@/lib/clients/loans.functions";

type LoanRow = { id: string; borrower_name: string; agreement_date: string; status: string };

export function LoansCard({
  orgId,
  orgName,
  clientId,
  clientName,
}: {
  orgId: string;
  orgName: string;
  clientId: string;
  clientName: string;
}) {
  const statusFn = useServerFn(getLoanFeatureStatus);
  const listFn = useServerFn(listClientLoans);
  const [editing, setEditing] = useState<{ loanId?: string; borrower: string } | null>(null);
  const statusQ = useQuery({
    queryKey: ["loan-feature-status", orgId],
    queryFn: () => statusFn({ data: { organization_id: orgId } }),
  });
  const enabled = statusQ.data?.enabled === true;
  const loansQ = useQuery({
    enabled,
    queryKey: ["loans", orgId, "client", clientId],
    queryFn: async () =>
      (await listFn({ data: { organization_id: orgId, client_id: clientId } })) as LoanRow[],
  });

  if (editing) {
    return (
      <LoanEditor
        organizationId={orgId}
        clientId={clientId}
        loanId={editing.loanId}
        defaultBorrower={editing.borrower}
        defaultLender={orgName}
        onClose={() => setEditing(null)}
      />
    );
  }

  const loans = loansQ.data ?? [];
  return (
    <SectionCard
      icon={HandCoins}
      tone="neutral"
      title="Loans"
      description="Loan agreements kept on file. Owners only; staff never see these."
      testId="client-money-loans"
      actions={
        enabled ? (
          <Button onClick={() => setEditing({ borrower: clientName })}>
            <Plus className="h-4 w-4" /> New loan
          </Button>
        ) : null
      }
    >
      {statusQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !enabled ? (
        <EmptyState
          action={
            <Button variant="outline" asChild>
              <Link to="/dashboard/client-loans">Open Client loans</Link>
            </Button>
          }
        >
          Loan records are off for your agency. Turn them on in Client loans.
        </EmptyState>
      ) : loans.length === 0 ? (
        <EmptyState>{loansQ.isLoading ? "Loading…" : "No loan agreements on file."}</EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border">
          {loans.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{l.borrower_name}</span>
              <span className="text-xs text-muted-foreground">{formatDate(l.agreement_date)}</span>
              <span className="text-xs capitalize">{l.status}</span>
              <Button
                variant="outline"
                onClick={() => setEditing({ loanId: l.id, borrower: l.borrower_name })}
              >
                Open loan
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
