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
}: {
  orgId: string;
  clientId: string;
  clientName: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const writeFn = useServerFn(writeClientRecord);
  const { user } = useAuth();
  const q = useClientPba(orgId, clientId);
  const [ledgerOpen, setLedgerOpen] = useState(false);
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
      title="PBA trust account"
      description="The client's money the agency holds, against the Medicaid limit."
      testId="client-money-pba"
      actions={
        account ? (
          <Button variant="outline" onClick={() => setLedgerOpen(true)}>
            Open ledger
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
              onOpenChange={setLedgerOpen}
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
    <div className="flex flex-wrap items-center gap-4">
      <Stat label="Balance" value={formatMoney(bal)} />
      <Stat label="Medicaid limit" value={formatMoney(thr)} />
      <Stat label="Room left" value={`${pbaHeadroomPercent(bal, thr)}%`} />
      <StatusTag tone={tone.tone}>{tone.label}</StatusTag>
      <span className="text-xs text-muted-foreground">Opened {formatDate(account.opened_on)}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}
