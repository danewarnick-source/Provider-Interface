// Rights restrictions (HRC) for this client — the single place they are
// added and edited: "any rights restrictions?", each restriction with its
// 8-element documentation count, and the signed HRC document.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Scale } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { computeRestrictionCompletion, type RestrictionRecord } from "@/lib/clients/hrc";
import { updateClient, writeClientRecord } from "@/lib/clients/writes.functions";
import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { RestrictionDialog } from "./restriction-dialog";
import { useLatestDocument } from "./use-latest-document";

const HRC_DOC_TYPES = ["hrc_approval", "human_rights"] as const;

export function RestrictionsCard({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const qc = useQueryClient();
  const clientId = data.client.id;
  const canEdit = useAccess().canCategory("hrc", "edit");
  const updateFn = useServerFn(updateClient);
  const writeFn = useServerFn(writeClientRecord);
  const [open, setOpen] = useState<RestrictionRecord | null>(null);
  const [title, setTitle] = useState("");
  const has = data.client.hr_applicable === true;
  const hrcDoc = useLatestDocument(orgId, clientId, HRC_DOC_TYPES);
  const q = useQuery({
    queryKey: ["client-restrictions", clientId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("hrc_restriction_records")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as unknown as RestrictionRecord[];
    },
  });
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
    onSuccess: () => {
      setTitle("");
      void qc.invalidateQueries({ queryKey: ["client-restrictions", clientId] });
      void qc.invalidateQueries({ queryKey: ["client-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = [...(q.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active));
  return (
    <SectionCard icon={Scale} tone="ok" title="Rights restrictions (HRC)" description="Each restriction needs all 8 elements documented.">
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
                const c = computeRestrictionCompletion(r);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(r)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {r.restriction_title}
                        {r.active ? "" : " (ended)"}
                      </span>
                      <StatusTag tone={c.isComplete ? "ok" : "profile"} className="shrink-0">
                        {c.completedCount}/{c.total} documented
                      </StatusTag>
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
            <NectarAsk
              question="Signed HRC restriction document (team member, coordinator and client signatures)"
              kind="data_rich_gap"
              clientId={clientId}
              uploadDocumentType="hrc_approval"
              answeredSummary={hrcDoc.data ? `On file: ${hrcDoc.data.file_name}` : null}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No restrictions — nothing more is needed here.</p>
        )}
      </div>
      {open ? (
        <RestrictionDialog record={open} clientName={data.name} canManage={canEdit} orgId={orgId} onClose={() => setOpen(null)} />
      ) : null}
    </SectionCard>
  );
}
