// The PBA ledger for one account: balance, every transaction with its
// receipt, and (Billing: Edit) a form to log a new one.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/clients/money";
import { PbaTransactionForm } from "./pba-transaction-form";
import { PBA_RECEIPTS_BUCKET, ReceiptLink } from "./receipt-link";
import type { PbaAccount } from "./use-client-money";

type PbaTx = {
  id: string;
  txn_type: string;
  amount: number;
  occurred_on: string;
  memo: string | null;
  receipt_url: string | null;
  counterparty: string | null;
};

export function PbaLedgerDialog({
  open,
  onOpenChange,
  orgId,
  account,
  clientName,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  account: PbaAccount;
  clientName: string;
  canEdit: boolean;
}) {
  const txQ = useQuery({
    enabled: open,
    queryKey: ["pba-tx", account.id],
    queryFn: async (): Promise<PbaTx[]> => {
      const { data, error } = await supabase
        .from("pba_transactions")
        .select("id, txn_type, amount, occurred_on, memo, receipt_url, counterparty")
        .eq("organization_id", orgId)
        .eq("account_id", account.id)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PbaTx[];
    },
  });
  const txs = txQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clientName} — PBA ledger</DialogTitle>
          <DialogDescription>
            Balance {formatMoney(Number(account.current_balance))} of a{" "}
            {formatMoney(Number(account.medicaid_threshold))} Medicaid limit.
          </DialogDescription>
        </DialogHeader>
        {canEdit ? <PbaTransactionForm orgId={orgId} account={account} /> : null}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Where / memo</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    {txQ.isLoading ? "Loading…" : "No transactions."}
                  </TableCell>
                </TableRow>
              ) : null}
              {txs.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.occurred_on}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      {t.txn_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{formatMoney(Number(t.amount))}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[t.counterparty, t.memo].filter(Boolean).join(" — ") || "—"}
                  </TableCell>
                  <TableCell>
                    <ReceiptLink path={t.receipt_url} bucket={PBA_RECEIPTS_BUCKET} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
