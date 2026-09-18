import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { dueSubtitleFromItem } from "@/lib/evidence/due.ts";
import {
  listMySentEvidence,
  recordEvidenceAttestation,
  recordEvidenceUpload,
} from "@/lib/evidence.functions";
import { cellStatus, latestFileForItem } from "@/lib/evidence/status.ts";
import { EvidenceStatusGlyph } from "./evidence-status-dot";

export function StaffEvidenceList() {
  const { data: org, isLoading } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listMySentEvidence);
  const uploadFn = useServerFn(recordEvidenceUpload);
  const attestFn = useServerFn(recordEvidenceAttestation);

  const q = useQuery({
    enabled: !!org?.organization_id,
    queryKey: ["my-sent-evidence", org?.organization_id],
    queryFn: () => listFn({ data: { organizationId: org!.organization_id } }),
  });

  const [documentByItem, setDocumentByItem] = useState<Record<string, string>>({});
  const uploadM = useMutation({
    mutationFn: (args: {
      itemId: string;
      storagePath: string;
      filename: string;
      documentDate?: string | null;
    }) =>
      uploadFn({
        data: {
          organizationId: org!.organization_id,
          expiresOn: null,
          ...args,
        },
      }),
    onSuccess: () => {
      toast.success("Uploaded.");
      void qc.invalidateQueries({ queryKey: ["my-sent-evidence"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const attestM = useMutation({
    mutationFn: (args: {
      itemId: string;
      attestationText: string;
      documentDate?: string | null;
    }) => attestFn({ data: { organizationId: org!.organization_id, ...args } }),
    onSuccess: () => {
      toast.success("Attested.");
      void qc.invalidateQueries({ queryKey: ["my-sent-evidence"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (!org) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Select an organization to see Evidence items sent to you.
      </div>
    );
  }

  const items = q.data?.items ?? [];
  const files = q.data?.files ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Only items your agency sent you. Admin-side packs stay off this phone list until Send to
        staff.
      </p>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Nothing sent to you yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const file = latestFileForItem(files, item.id);
            const status = cellStatus({ item, file, today });
            return (
              <li key={item.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.evidence_type === "attestation" ? "Attest" : "Upload"} ·{" "}
                      {dueSubtitleFromItem(item)}
                    </p>
                    {item.send_message?.trim() ? (
                      <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Message from your agency
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{item.send_message}</p>
                      </div>
                    ) : null}
                  </div>
                  <EvidenceStatusGlyph status={status} />
                </div>
                {item.renew_years === 1 || item.renew_years === 2 ? (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      Document / certificate date
                    </span>
                    <Input
                      type="date"
                      value={documentByItem[item.id] ?? item.document_date ?? ""}
                      onChange={(e) =>
                        setDocumentByItem((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                  </label>
                ) : null}
                {item.evidence_type === "attestation" ? (
                  <Button
                    type="button"
                    className="mt-3"
                    disabled={attestM.isPending}
                    onClick={() =>
                      attestM.mutate({
                        itemId: item.id,
                        attestationText:
                          item.attestation_text || `I attest that ${item.title} is complete.`,
                        documentDate: documentByItem[item.id] || item.document_date,
                      })
                    }
                  >
                    I attest
                  </Button>
                ) : (
                  <label className="mt-3 block">
                    <span className="sr-only">Upload file</span>
                    <Input
                      type="file"
                      onChange={async (e) => {
                        const picked = e.target.files?.[0];
                        if (!picked) return;
                        const safe = picked.name.replace(/[^\w.-]+/g, "_");
                        const path = `${org.organization_id}/${item.id}/${Date.now()}-${safe}`;
                        const up = await supabase.storage
                          .from("evidence-files")
                          .upload(path, picked, {
                            upsert: true,
                          });
                        if (up.error) {
                          toast.error(up.error.message);
                          return;
                        }
                        uploadM.mutate({
                          itemId: item.id,
                          storagePath: path,
                          filename: picked.name,
                          documentDate: documentByItem[item.id] || item.document_date,
                        });
                      }}
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
