// This quarter's independent PBA audit (a 10% sample of the agency's PBA
// accounts). Shows whether this account was picked and lets someone other
// than the person who opened it verify. When no sample exists yet this
// quarter, an editor can pick it here.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canVerifyPbaSample } from "@/lib/clients/money";
import { writeClientRecord } from "@/lib/clients/writes.functions";
import type { PbaAccount, PbaAuditSample } from "./use-client-money";

export function PbaAuditRow({
  orgId,
  clientId,
  account,
  sample,
  canEdit,
}: {
  orgId: string;
  clientId: string;
  account: PbaAccount;
  sample: PbaAuditSample | null;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const writeFn = useServerFn(writeClientRecord);
  const [verifying, setVerifying] = useState(false);
  const [notes, setNotes] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: ["client-pba"] });

  const pickM = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("generate_pba_audit_sample", { _org: orgId });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`This quarter's audit sample picked (${n} account${n === 1 ? "" : "s"})`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyM = useMutation({
    mutationFn: async () => {
      if (!sample || !user) return;
      if (!canVerifyPbaSample(account.created_by, user.id)) {
        throw new Error("The person who opened this account can't verify its audit.");
      }
      await writeFn({
        data: {
          organizationId: orgId,
          clientId,
          table: "pba_audit_samples",
          op: "update",
          id: sample.id,
          values: {
            status: "verified",
            verified_at: new Date().toISOString(),
            assigned_auditor: user.id,
            verifier_notes: notes,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Audit verified");
      setVerifying(false);
      setNotes("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"
      data-testid="pba-audit"
    >
      <span className="font-medium">Quarterly audit:</span>
      {!sample ? (
        <>
          <span className="text-muted-foreground">Not in this quarter's sample.</span>
          {canEdit ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => pickM.mutate()}
              disabled={pickM.isPending}
            >
              <Shuffle className="mr-1 h-3.5 w-3.5" /> Pick this quarter's sample
            </Button>
          ) : null}
        </>
      ) : sample.status === "verified" ? (
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
        >
          Verified {sample.verified_at ? new Date(sample.verified_at).toLocaleDateString() : ""}
        </Badge>
      ) : (
        <>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-700 dark:text-amber-300"
          >
            Picked — needs independent verification
          </Badge>
          {canEdit && user && canVerifyPbaSample(account.created_by, user.id) ? (
            <Button size="sm" className="ml-auto" onClick={() => setVerifying(true)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Verify
            </Button>
          ) : null}
        </>
      )}
      <Dialog open={verifying} onOpenChange={setVerifying}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Independent audit verification</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="pba-verify-notes">What you checked</Label>
            <Textarea
              id="pba-verify-notes"
              rows={4}
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Balance confirmed, receipts cross-checked…"
            />
          </div>
          <DialogFooter>
            <Button onClick={() => verifyM.mutate()} disabled={!notes.trim() || verifyM.isPending}>
              {verifyM.isPending ? "Verifying…" : "Confirm verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
