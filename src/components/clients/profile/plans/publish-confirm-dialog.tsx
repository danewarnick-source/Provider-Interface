// Approve and publish a client-specific training or the support strategies:
// shows who receives it (the assigned team) and can assign more team members
// first. For support strategies with supports still lacking a strategy, it
// lists them and asks for a reason before approving. Assignment stays the
// single source of truth for access.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setStaffClientCodes } from "@/lib/scheduler/setup.functions";
import { loadActiveCodes } from "@/lib/clients/codes";
import { useOrgStaff } from "@/components/clients/shared/hooks/use-org-staff";
import { invalidateTeam } from "@/components/clients/profile/team/team-changes";

export function PublishConfirmDialog({
  open, onOpenChange, clientId, orgId, kindLabel, isPublishing, publishAsync, questions, gaps,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  orgId?: string;
  kindLabel: string;
  isPublishing: boolean;
  /** Called with the reason when approving with gaps. */
  publishAsync: (note?: string) => Promise<unknown>;
  questions?: Array<{ id: string; prompt: string }>;
  /** Supports with no strategy yet: listed, and a reason is required. */
  gaps?: string[];
}) {
  const [reason, setReason] = useState("");
  const needReason = !!gaps?.length;

  const qc = useQueryClient();
  const setStaffCodesFn = useServerFn(setStaffClientCodes);
  const [stagedAdds, setStagedAdds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const staffQ = useOrgStaff(open ? orgId : undefined);

  const currentQ = useQuery({
    enabled: !!orgId && !!clientId && open,
    queryKey: ["client-team-publish", orgId, clientId],
    queryFn: async (): Promise<{ staffIds: string[]; codes: string[] }> => {
      const [a, c] = await Promise.all([
        supabase
          .from("staff_assignments")
          .select("staff_id")
          .eq("organization_id", orgId!)
          .eq("client_id", clientId),
        loadActiveCodes(supabase, [clientId]),
      ]);
      if (a.error) throw a.error;
      return {
        staffIds: (a.data ?? []).map((r) => (r as { staff_id: string }).staff_id),
        codes: c.get(clientId) ?? [],
      };
    },
  });

  const staff = staffQ.data ?? [];
  const currentIds = currentQ.data?.staffIds ?? [];
  // New staff get every authorized code, listed explicitly (narrow later on
  // the client's Caseload). No authorized codes → nobody can be added.
  const clientCodes = currentQ.data?.codes ?? [];
  const currentSet = new Set(currentIds);
  const assignedStaff = staff.filter((s) => currentSet.has(s.id));
  const availableStaff = staff.filter((s) => !currentSet.has(s.id));
  const totalAfter = currentIds.length + stagedAdds.size;
  const zeroWarn = totalAfter === 0;
  const loading = staffQ.isLoading || currentQ.isLoading;

  async function handleConfirm() {
    if (!orgId) return;
    setBusy(true);
    try {
      const adds = Array.from(stagedAdds);
      if (adds.length > 0) {
        for (const staffId of adds) {
          await setStaffCodesFn({
            data: { organizationId: orgId, staffId, clientId, codes: clientCodes },
          });
        }
        qc.invalidateQueries({ queryKey: ["client-team-publish"] });
        invalidateTeam(qc);
      }
      await publishAsync(needReason ? reason.trim() : undefined);
      const total = currentIds.length + adds.length;
      toast.success(`Published — ${total} assigned staff will receive it.`);
      setStagedAdds(new Set());
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy && !isPublishing) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve &amp; publish — who will get this?</DialogTitle>
          <DialogDescription>
            Staff assigned to this client automatically receive this {kindLabel} when published.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {needReason && (
            <div className="space-y-2 rounded-xl border border-hive-gold/50 bg-hive-gold-soft p-3 text-sm text-hive-ink">
              <p className="font-medium">
                {gaps!.length} support{gaps!.length === 1 ? " has" : "s have"} no strategy yet:
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs">
                {gaps!.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
              <label className="block text-xs font-medium" htmlFor="approve-gap-reason">
                Why approve without them?
              </label>
              <Textarea id="approve-gap-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          {questions && questions.length > 0 && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Questions staff will complete with the client ({questions.length})
              </p>
              <ol className="list-decimal pl-5 space-y-2.5 text-sm leading-relaxed marker:text-muted-foreground">
                {questions.map((q) => (
                  <li key={q.id} className="pl-1">{q.prompt}</li>
                ))}
              </ol>
              <p className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                Staff complete these together with the person and attest the responses reflect the individual's own perspective.
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Currently assigned
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground"><Loader2 className="inline h-3.5 w-3.5 animate-spin mr-1.5" />Loading…</p>
            ) : assignedStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No staff assigned yet.</p>
            ) : (
              <ul className="space-y-1">
                {assignedStaff.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm rounded border border-border/60 bg-muted/30 px-2 py-1">
                    <span>{s.name}</span>
                    <span className="text-xs text-muted-foreground">will receive automatically</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Add more staff (assigns them to this client)
            </p>
            {loading ? null : clientCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                This client has no authorized codes yet. Add a code before assigning staff.
              </p>
            ) : availableStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">All active staff are already assigned.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto rounded border p-2">
                {availableStaff.map((s) => {
                  const checked = stagedAdds.has(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer rounded px-1.5 py-1 hover:bg-muted">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          setStagedAdds((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(s.id); else next.delete(s.id);
                            return next;
                          });
                        }}
                      />
                      <span>{s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {!loading && clientCodes.length > 0 && availableStaff.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Added staff get all of this client&apos;s codes ({clientCodes.join(", ")}). Narrow
                them on the Caseload tab.
              </p>
            )}
          </div>

          {zeroWarn && !loading && (
            <div className="rounded-xl border border-hive-gold/50 bg-hive-gold-soft px-3 py-2 text-xs text-hive-ink">
              No staff are assigned to this client yet. You can publish now — staff will receive this {kindLabel} automatically once you assign them. Publish anyway?
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy || isPublishing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={busy || isPublishing || loading || !orgId || (needReason && !reason.trim())}>
            {(busy || isPublishing)
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
            Approve &amp; publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
