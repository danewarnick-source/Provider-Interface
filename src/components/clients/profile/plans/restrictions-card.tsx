// Rights restrictions (HRRs) for this client — the single place they are
// added and edited: "any rights restrictions?", each HRR with its status and
// who has or hasn't signed, and any earlier HRC uploads not tied to an HRR.
// Each HRR's own document is uploaded inside the HRR (restriction-dialog.tsx).

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, FileText, Plus, Scale } from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/hooks/use-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  HRR_STATUS_LABEL,
  hrrSignatures,
  hrrStatus,
  type HrrStatus,
  type RestrictionRecord,
} from "@/lib/clients/hrc";
import { updateClient, writeClientRecord } from "@/lib/clients/writes.functions";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { RestrictionDialog } from "./restriction-dialog";
import {
  clientRestrictionsKey,
  openClientDocument,
  useClientRestrictions,
  useHrcDocuments,
} from "./use-hrr";

const STATUS_TONE: Record<HrrStatus, "ok" | "profile" | "info" | "danger"> = {
  signed: "ok",
  awaiting_signatures: "info",
  draft: "profile",
  denied: "danger",
};

export function RestrictionsCard({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const qc = useQueryClient();
  const clientId = data.client.id;
  const access = useAccess();
  const canEdit = access.canCategory("hrc", "edit");
  const updateFn = useServerFn(updateClient);
  const writeFn = useServerFn(writeClientRecord);
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const has = data.client.hr_applicable === true;
  const q = useClientRestrictions(clientId);
  const docs = useHrcDocuments(orgId, clientId);
  const toggle = useMutation({
    mutationFn: (v: boolean) => updateFn({ data: { organizationId: orgId, clientId, patch: { hr_applicable: v } } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["client-profile"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const add = useMutation({
    mutationFn: () =>
      writeFn({
        data: {
          organizationId: orgId,
          clientId,
          table: "hrc_restriction_records",
          op: "insert",
          values: { restriction_title: title.trim(), active: true },
        },
      }),
    onSuccess: async (res) => {
      setTitle("");
      await qc.invalidateQueries({ queryKey: clientRestrictionsKey(clientId) });
      void qc.invalidateQueries({ queryKey: ["client-overview"] });
      setOpenId(res.ids[0] ?? null);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = [...(q.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active));
  const open: RestrictionRecord | null = rows.find((r) => r.id === openId) ?? null;
  const linked = new Set(rows.map((r) => r.document_id).filter(Boolean));
  const earlier = (docs.data ?? []).filter((d) => !linked.has(d.id));
  return (
    <SectionCard
      icon={Scale}
      tone="ok"
      title="Rights restrictions (HRC)"
      description="Each restriction needs its answers, informed consent, and every signature."
    >
      <div className="space-y-3" data-testid="client-restrictions">
        <label className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3 text-sm">
          <span className="font-medium">Does this client have any rights restrictions?</span>
          <Switch checked={has} disabled={!canEdit || toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} />
        </label>
        {has ? (
          <>
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">No restrictions written yet.</p> : null}
            <ul className="space-y-2">
              {rows.map((r) => {
                const status = hrrStatus(r);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      className="w-full space-y-2 rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="flex min-h-7 items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">
                          {r.restriction_title}
                          {r.active ? "" : " (ended)"}
                        </span>
                        <StatusTag tone={STATUS_TONE[status]} className="shrink-0">
                          {HRR_STATUS_LABEL[status]}
                        </StatusTag>
                      </span>
                      <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {hrrSignatures(r).map((s) => (
                          <span key={s.key} className={s.done ? "text-emerald-700" : undefined}>
                            {s.done ? <Check className="mr-0.5 inline h-3 w-3" /> : null}
                            {s.label}: {s.done ? (s.name ?? "Done") : "not yet"}
                          </span>
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {canEdit ? (
              <div className="flex gap-2">
                <Input value={title} placeholder="New restriction, e.g. locked pantry at night" onChange={(e) => setTitle(e.target.value)} />
                <Button disabled={!title.trim() || add.isPending} onClick={() => add.mutate()}>
                  <Plus className="h-4 w-4" /> Add restriction
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No restrictions — nothing more is needed here.</p>
        )}
        {earlier.length ? (
          <div className="space-y-1 rounded-md border border-border/60 p-3" data-testid="hrr-earlier-uploads">
            <div className="text-xs font-medium text-muted-foreground">Earlier uploads</div>
            {earlier.map((d) => (
              <button
                key={d.id}
                type="button"
                className="flex items-center gap-1.5 text-left text-sm text-primary underline"
                onClick={() => void openClientDocument(d.storage_path)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {d.file_name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {open ? (
        <RestrictionDialog record={open} clientName={data.name} canManage={canEdit} orgId={orgId} onClose={() => setOpenId(null)} />
      ) : null}
    </SectionCard>
  );
}
