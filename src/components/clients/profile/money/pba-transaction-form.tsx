// Log a PBA transaction. Receipts are required over $50; the file is stored
// with the transaction, and the amount and details are always typed by a
// person (nothing is read off the receipt).

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImageIcon, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayYmd } from "@/lib/clients/dates";
import { PBA_TXN_TYPES, pbaNeedsReceipt } from "@/lib/clients/money";
import { writeClientRecord } from "@/lib/clients/writes.functions";
import { PBA_RECEIPTS_BUCKET } from "./receipt-link";
import type { PbaAccount } from "./use-client-money";

export function PbaTransactionForm({ orgId, account }: { orgId: string; account: PbaAccount }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const writeFn = useServerFn(writeClientRecord);
  const [type, setType] = useState<string>("withdrawal");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [counterparty, setCounterparty] = useState("");
  const [memo, setMemo] = useState("");
  const [receipt, setReceipt] = useState("");
  const [uploading, setUploading] = useState(false);
  const needsReceipt = pbaNeedsReceipt(Number(amount));

  async function upload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${orgId}/${account.client_id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(PBA_RECEIPTS_BUCKET).upload(path, file);
      if (error) throw error;
      setReceipt(path);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const addM = useMutation({
    mutationFn: () =>
      writeFn({
        data: {
          organizationId: orgId,
          clientId: account.client_id,
          table: "pba_transactions",
          op: "insert",
          values: {
            account_id: account.id,
            txn_type: type,
            amount: Number(amount),
            occurred_on: date,
            memo: memo.trim() || null,
            counterparty: counterparty.trim() || null,
            receipt_url: receipt || null,
            created_by: user?.id ?? null,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Transaction logged");
      setAmount("");
      setMemo("");
      setCounterparty("");
      setReceipt("");
      void qc.invalidateQueries({ queryKey: ["pba-tx", account.id] });
      void qc.invalidateQueries({ queryKey: ["client-pba"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 rounded-lg border p-4" data-testid="pba-transaction-form">
      <h4 className="text-sm font-semibold">New transaction</h4>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="grid gap-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label="Type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PBA_TXN_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pba-amount">Amount</Label>
          <Input
            id="pba-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pba-date">Date</Label>
          <Input id="pba-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pba-where">Where</Label>
          <Input
            id="pba-where"
            value={counterparty}
            maxLength={120}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5 md:col-span-4">
          <Label htmlFor="pba-memo">Memo</Label>
          <Input id="pba-memo" value={memo} maxLength={300} onChange={(e) => setMemo(e.target.value)} />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm hover:bg-muted/40">
        <input
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <ImageIcon className="h-4 w-4" />
        {uploading ? "Uploading…" : receipt ? "Receipt attached — choose another to replace" : "Attach a receipt (PNG, JPG or PDF)"}
      </label>
      {needsReceipt && !receipt ? (
        <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <Receipt className="h-3.5 w-3.5" /> A receipt is required over $50.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          onClick={() => addM.mutate()}
          disabled={!(Number(amount) > 0) || !date || addM.isPending || uploading || (needsReceipt && !receipt)}
        >
          {addM.isPending ? "Saving…" : "Log transaction"}
        </Button>
      </div>
    </div>
  );
}
