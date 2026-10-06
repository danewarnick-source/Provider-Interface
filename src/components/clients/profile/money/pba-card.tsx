// PBA trust account for this client: balance against the Medicaid limit, the
// ledger, and this quarter's independent audit sample. Opening an account,
// logging transactions and verifying need Billing: Edit.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { writeClientRecord } from "@/lib/clients/writes.functions";
import { formatMoney, pbaHeadroomPercent, pbaTone, type PbaTone } from "@/lib/clients/money";
import { PbaAuditRow } from "./pba-audit-row";
import { PbaLedgerDialog } from "./pba-ledger-dialog";
import { pbaAccountKey, useClientPba } from "./use-client-money";

const TONE: Record<PbaTone, { label: string; cls: string }> = {
  healthy: {
    label: "Healthy",
    cls: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  },
  watch: { label: "Watch", cls: "border-amber-500/40 text-amber-700 dark:text-amber-300" },
  near_limit: {
    label: "Near the Medicaid limit",
    cls: "border-red-500/40 text-red-700 dark:text-red-300",
  },
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
    <Card data-testid="client-money-pba">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" /> PBA trust account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !account ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">No PBA account is open for this client.</p>
            {canEdit ? (
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
                    className="w-40"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => openM.mutate()}
                  disabled={!(Number(threshold) > 0) || openM.isPending}
                >
                  <Plus className="mr-1 h-4 w-4" /> Open PBA account
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <AccountSummary account={account} onOpen={() => setLedgerOpen(true)} />
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
      </CardContent>
    </Card>
  );
}

function AccountSummary({
  account,
  onOpen,
}: {
  account: { current_balance: number; medicaid_threshold: number; opened_on: string };
  onOpen: () => void;
}) {
  const bal = Number(account.current_balance);
  const thr = Number(account.medicaid_threshold);
  const tone = TONE[pbaTone(bal, thr)];
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Stat label="Balance" value={formatMoney(bal)} />
      <Stat label="Medicaid limit" value={formatMoney(thr)} />
      <Stat label="Room left" value={`${pbaHeadroomPercent(bal, thr)}%`} />
      <Badge variant="outline" className={tone.cls}>
        {tone.label}
      </Badge>
      <span className="text-xs text-muted-foreground">Opened {account.opened_on}</span>
      <Button size="sm" variant="outline" className="ml-auto" onClick={onOpen}>
        Open ledger
      </Button>
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
