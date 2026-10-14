// PBA trust account for this client: balance against the Medicaid limit, the
// ledger, and this quarter's independent audit sample. Opening an account,
// logging transactions and verifying need Billing: Edit.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState, StatusTag } from "@/components/clients/profile/cards/card-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/clients/dates";
import { writeClientRecord } from "@/lib/clients/writes.functions";
import { formatMoney, pbaHeadroomPercent, pbaTone, type PbaTone } from "@/lib/clients/money";
import { PbaAuditRow } from "./pba-audit-row";
import { PbaLedgerDialog } from "./pba-ledger-dialog";
import { pbaAccountKey, useClientPba } from "./use-client-money";

const TONE: Record<PbaTone, { label: string; tone: "ok" | "profile" | "danger" }> = {
  healthy: { label: "Healthy", tone: "ok" },
  watch: { label: "Watch", tone: "profile" },
  near_limit: { label: "Near the Medicaid limit", tone: "danger" },
};

export function PbaCard({
  orgId,
  clientId,
  clientName,
  canEdit,
  ledgerOpen,
  onLedgerOpenChange,
}: {
  orgId: string;
  clientId: string;
  clientName: string;
  canEdit: boolean;
  /** The ledger dialog (also opened by the Money header's "Add transaction"). */
  ledgerOpen: boolean;
  onLedgerOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const writeFn = useServerFn(writeClientRecord);
  const { user } = useAuth();
  const q = useClientPba(orgId, clientId);
  const [threshold, setThreshold] = useState("2000");
  const account = q.data?.account ?? null;

  const openM = useMutation({
    mutationFn: () =>
      writeFn({
        data: {
          organizationId: orgId,
          clientId,
          table: "pba_accounts",
          op: "insert",
          values: { medicaid_threshold: Number(threshold), created_by: user?.id ?? null },
        },
      }),
    onSuccess: () => {
      toast.success("PBA account opened");
      void qc.invalidateQueries({ queryKey: pbaAccountKey(orgId, clientId) });
      void qc.invalidateQueries({ queryKey: ["client-money-presence"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      icon={Wallet}
      tone="neutral"
      title="PBA ledger"
      description="Every deposit and withdrawal, with receipts, and this quarter's audit sample."
      testId="client-money-pba"
      actions={
        account ? (
          <Button variant="outline" onClick={() => onLedgerOpenChange(true)}>
            Open PBA ledger
          </Button>
        ) : null
      }
    >
      <div className="space-y-3">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !account ? (
          <EmptyState
            action={
              canEdit ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="pba-threshold" className="text-xs">
                      Medicaid limit (USD)
                    </Label>
                    <Input
                      id="pba-threshold"
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-10 w-40"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => openM.mutate()}
                    disabled={!(Number(threshold) > 0) || openM.isPending}
                  >
                    <Plus className="h-4 w-4" /> Open PBA account
                  </Button>
                </div>
              ) : null
            }
          >
            No PBA account is open for this client.
          </EmptyState>
        ) : (
          <>
            <AccountSummary account={account} />
            <PbaAuditRow
              orgId={orgId}
              clientId={clientId}
              account={account}
              sample={q.data?.sample ?? null}
              canEdit={canEdit}
            />
            <PbaLedgerDialog
              open={ledgerOpen}
              onOpenChange={onLedgerOpenChange}
              orgId={orgId}
              account={account}
              clientName={clientName}
              canEdit={canEdit}
            />
          </>
        )}
      </div>
    </SectionCard>
  );
}

function AccountSummary({
  account,
}: {
  account: { current_balance: number; medicaid_threshold: number; opened_on: string };
}) {
  const bal = Number(account.current_balance);
  const thr = Number(account.medicaid_threshold);
  const tone = TONE[pbaTone(bal, thr)];
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <StatusTag tone={tone.tone}>{tone.label}</StatusTag>
      <span>
        Medicaid limit {formatMoney(thr)} · {pbaHeadroomPercent(bal, thr)}% room left · opened{" "}
        {formatDate(account.opened_on)}
      </span>
    </p>
  );
}
