// Loan agreements on file for this client (owner only, like the rest of the
// loan records). Opens the shared loan editor. When the agency hasn't turned
// loan records on, points to the Client loans page where that's done.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HandCoins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { formatDate } from "@/lib/clients/dates";
import { LoanEditor } from "@/components/loans/loan-editor";
import { useClientLoans } from "./use-client-money";

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
  const [editing, setEditing] = useState<{ loanId?: string; borrower: string } | null>(null);
  const { status: statusQ, loans: loansQ, enabled } = useClientLoans(orgId, clientId, true);

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
