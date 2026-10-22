// Personal Belongings Inventory — SOW §11.3(5). One unified card for any
// client receiving HHS, RHS, or SLH. Items $50+ require a guardian
// signature before they can be marked discarded (enforced by the
// trg_belongings_sig DB trigger; the signature pad here satisfies it).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Package, Plus, History } from "lucide-react";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SignaturePad } from "@/components/forms/signature-pad";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAuth } from "@/hooks/use-auth";
import {
  listClientBelongings,
  addClientBelonging,
  discardClientBelonging,
  type ClientBelongingRow,
} from "@/lib/clients/belongings.functions";
import { formatDate } from "@/lib/clients/dates";

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BelongingsInventoryCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: org } = useCurrentOrg();
  const { user } = useAuth();
  const orgId = org?.organization_id;
  const qc = useQueryClient();
  const listFn = useServerFn(listClientBelongings);
  const addFn = useServerFn(addClientBelonging);
  const discardFn = useServerFn(discardClientBelonging);

  const [showHistory, setShowHistory] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<ClientBelongingRow | null>(null);

  const q = useQuery({
    enabled: !!orgId,
    queryKey: ["client-belongings", orgId, clientId],
    queryFn: () => listFn({ data: { organizationId: orgId!, clientId } }),
  });

  const rows = q.data ?? [];
  const active = useMemo(() => rows.filter((r) => r.status === "active"), [rows]);
  const discarded = useMemo(() => rows.filter((r) => r.status === "discarded"), [rows]);
  const lastUpdated = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((latest, r) => (r.updated_at > latest.updated_at ? r : latest), rows[0]);
  }, [rows]);

  const addMut = useMutation({
    mutationFn: (input: { itemName: string; description: string; estimatedValue: number; inventoriedOn: string }) =>
      addFn({
        data: {
          organizationId: orgId!,
          clientId,
          itemName: input.itemName,
          description: input.description || null,
          estimatedValue: input.estimatedValue,
          inventoriedOn: input.inventoriedOn,
          inventoriedByName: user?.user_metadata?.full_name ?? user?.email ?? "Staff",
        },
      }),
    onSuccess: () => {
      toast.success("Item added to inventory.");
      qc.invalidateQueries({ queryKey: ["client-belongings", orgId, clientId] });
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const discardMut = useMutation({
    mutationFn: (input: { discardReason: string; discardedOn: string; signature: string | null }) =>
      discardFn({
        data: {
          organizationId: orgId!,
          belongingId: discardTarget!.id,
          discardReason: input.discardReason,
          discardedOn: input.discardedOn,
          guardianSignatureDataUrl: input.signature,
        },
      }),
    onSuccess: () => {
      toast.success("Item marked discarded.");
      qc.invalidateQueries({ queryKey: ["client-belongings", orgId, clientId] });
      setDiscardTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      icon={Package}
      tone="info"
      title="Personal belongings inventory"
      description={
        lastUpdated
          ? `Last updated ${formatDate(lastUpdated.updated_at.slice(0, 10))} by ${lastUpdated.inventoried_by_name ?? "staff"}`
          : "What they own, kept up to date. Items $50 or more need a guardian signature to discard."
      }
      actions={
        <>
          <Button variant="outline" onClick={() => setShowHistory((v) => !v)}>
            <History className="h-4 w-4" /> {showHistory ? "Hide discarded items" : "Show discarded items"}
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : active.length === 0 ? (
          <EmptyState>No active belongings on file for {clientName}.</EmptyState>
        ) : (
          <div className="space-y-2">
            {active.map((r) => (
              <BelongingRow key={r.id} row={r} onDiscard={() => setDiscardTarget(r)} />
            ))}
          </div>
        )}

        {showHistory && (
          <div className="border-t border-border/60 pt-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Discarded items</div>
            {discarded.length === 0 ? (
              <p className="text-sm text-muted-foreground">No discarded items.</p>
            ) : (
              discarded.map((r) => <BelongingRow key={r.id} row={r} discardedView />)
            )}
          </div>
        )}
      </div>

      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        busy={addMut.isPending}
        onSubmit={(v) => addMut.mutate(v)}
      />

      <DiscardDialog
        row={discardTarget}
        onOpenChange={(v) => { if (!v) setDiscardTarget(null); }}
        busy={discardMut.isPending}
        onSubmit={(v) => discardMut.mutate(v)}
      />
    </SectionCard>
  );
}

function BelongingRow({ row, onDiscard, discardedView }: { row: ClientBelongingRow; onDiscard?: () => void; discardedView?: boolean }) {
  const is50Plus = row.estimated_value >= 50;
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border/60 p-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{row.item_name}</span>
          <span className="text-sm text-muted-foreground">{fmtMoney(row.estimated_value)}</span>
          {is50Plus && <Badge variant="outline" className="text-[10px]">$50 or more</Badge>}
          {discardedView && <Badge variant="secondary" className="text-[10px]">Discarded</Badge>}
        </div>
        {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
        <p className="text-[11px] text-muted-foreground">
          Inventoried {formatDate(row.inventoried_on)} by {row.inventoried_by_name ?? "staff"}
        </p>
        {discardedView && (
          <p className="text-[11px] text-muted-foreground">
            Discarded {formatDate(row.discarded_on)} — {row.discard_reason}
            {row.guardian_signature_data_url ? " · guardian signature on file" : ""}
          </p>
        )}
      </div>
      {!discardedView && onDiscard && (
        <RowMenu
          label={`More actions for ${row.item_name}`}
          items={[{ label: "Discard item", danger: true, onSelect: onDiscard }]}
        />
      )}
    </div>
  );
}

function AddItemDialog({
  open, onOpenChange, busy, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  busy: boolean;
  onSubmit: (v: { itemName: string; description: string; estimatedValue: number; inventoriedOn: string }) => void;
}) {
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [inventoriedOn, setInventoriedOn] = useState(new Date().toISOString().slice(0, 10));
  const value = Number(estimatedValue) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add belonging</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Item name</Label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. iPhone 14" />
          </div>
          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Estimated value</Label>
              <Input type="number" min="0" step="0.01" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Inventoried on</Label>
              <Input type="date" value={inventoriedOn} onChange={(e) => setInventoriedOn(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={value >= 50} disabled readOnly />
            $50 or more (set automatically from estimated value)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!itemName.trim() || busy}
            onClick={() => {
              onSubmit({ itemName: itemName.trim(), description, estimatedValue: value, inventoriedOn });
              setItemName(""); setDescription(""); setEstimatedValue("");
            }}
          >
            {busy ? "Saving…" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscardDialog({
  row, onOpenChange, busy, onSubmit,
}: {
  row: ClientBelongingRow | null;
  onOpenChange: (v: boolean) => void;
  busy: boolean;
  onSubmit: (v: { discardReason: string; discardedOn: string; signature: string | null }) => void;
}) {
  const [discardReason, setDiscardReason] = useState("");
  const [discardedOn, setDiscardedOn] = useState(new Date().toISOString().slice(0, 10));
  const [signature, setSignature] = useState<string | null>(null);
  const needsSignature = (row?.estimated_value ?? 0) >= 50;

  if (!row) return null;
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Discard "{row.item_name}"</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Discarded on</Label>
              <Input type="date" value={discardedOn} onChange={(e) => setDiscardedOn(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Discard reason</Label>
            <Textarea value={discardReason} onChange={(e) => setDiscardReason(e.target.value)} rows={2} />
          </div>
          {needsSignature && (
            <div className="space-y-1">
              <Label>Guardian signature — required for items $50 or more (SOW §11.3(5))</Label>
              <SignaturePad value={signature} onChange={setSignature} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!discardReason.trim() || busy || (needsSignature && !signature)}
            onClick={() => onSubmit({ discardReason: discardReason.trim(), discardedOn, signature })}
          >
            {busy ? "Saving…" : "Confirm discard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
