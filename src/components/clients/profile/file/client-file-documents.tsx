// The Client file's documents, read from Evidence (the same records the
// Evidence page shows): the "What's required" card, then one card per pack
// with its rows. Uploads, "Not needed" and undo all go through the Evidence
// server functions. Nothing shows as Missing until the agency picks packs.

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { removeEvidenceRequirement, restoreEvidenceRequirement } from "@/lib/evidence.functions";
import { EVIDENCE_LIABILITY_TEXT } from "@/lib/evidence/types";
import type { ClientFileRow } from "@/lib/clients/file-rows";
import { ClientPackReview } from "./client-pack-review";
import { EVIDENCE_BUCKET, EvidenceUploadDialog } from "./evidence-upload-dialog";
import { FileRow } from "./file-row";
import { NotNeededDialog } from "./not-needed-dialog";
import { useClientFile } from "./use-client-file";
import { WhatsRequiredCard } from "./whats-required-card";

type SavedRow = ClientFileRow & { itemId: string };

async function openFile(path: string) {
  const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return toast.error(error?.message ?? "Couldn't open the file.");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function ClientFileDocuments({
  orgId,
  clientId,
  clientName,
  firstName,
  canEdit,
  canManage,
}: {
  orgId: string;
  clientId: string;
  clientName: string;
  firstName: string;
  /** Clients edit: upload and confirm documents. */
  canEdit: boolean;
  /** Owners and agency admins with Clients edit: packs, Not needed, undo. */
  canManage: boolean;
}) {
  const navigate = useNavigate();
  const { q, refresh } = useClientFile(orgId, clientId, canManage);
  const skipFn = useServerFn(removeEvidenceRequirement);
  const restoreFn = useServerFn(restoreEvidenceRequirement);
  const [uploading, setUploading] = useState<SavedRow | null>(null);
  const [waiving, setWaiving] = useState<SavedRow | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the change.");
    } finally {
      setBusy(false);
    }
  }

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading the client file…</p>;
  if (q.error || !q.data) {
    return (
      <p className="text-sm text-destructive">
        {q.error instanceof Error ? q.error.message : "Couldn't load the client file."}
      </p>
    );
  }
  const data = q.data;
  const disclaimer = <p className="text-xs text-muted-foreground">{EVIDENCE_LIABILITY_TEXT}</p>;
  const existingKeys = new Set(data.groups.flatMap((g) => g.rows.map((r) => r.key)));
  const review = reviewing ? (
    <ClientPackReview
      orgId={orgId}
      clientId={clientId}
      clientName={clientName}
      activeCodes={data.activeCodes}
      onClose={() => setReviewing(false)}
      onSaved={refresh}
    />
  ) : null;

  if (data.groups.length === 0) {
    return (
      <SectionCard
        icon={FileCheck2}
        tone="info"
        title="Client file"
        description="The documents your agency keeps for this client."
        testId="client-file-empty"
      >
        <div className="mt-4 space-y-3">
          <EmptyState
            action={
              canManage ? (
                <Button onClick={() => setReviewing(true)}>Choose document packs</Button>
              ) : undefined
            }
          >
            Choose which documents your agency keeps for each client.
            {canManage ? null : " An owner or admin sets this up."}
          </EmptyState>
          {disclaimer}
        </div>
        {review}
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="client-file-documents">
      <WhatsRequiredCard
        orgId={orgId}
        clientId={clientId}
        firstName={firstName}
        activePackKeys={data.activePackKeys}
        activeCodes={data.activeCodes}
        existingKeys={existingKeys}
        canManage={canManage}
        onChanged={refresh}
      />
      {data.groups.map((g) => (
        <SectionCard
          key={g.key}
          icon={FileCheck2}
          tone={g.key === "not_needed" ? "neutral" : "info"}
          title={g.title}
          description={g.key === "not_needed" ? g.description : `${g.origin} · ${g.description}`}
          testId={`client-file-pack-${g.key}`}
        >
          <ul className="mt-2 divide-y divide-hive-border">
            {g.rows.map((row) => (
              <FileRow
                key={row.key}
                row={row}
                canEdit={canEdit}
                canManage={canManage && !busy}
                onUpload={setUploading}
                onOpenFile={(path) => void openFile(path)}
                onOpenSection={(section) =>
                  void navigate({
                    to: "/dashboard/clients/$clientId",
                    params: { clientId },
                    search: { section },
                  })
                }
                onNotNeeded={setWaiving}
                onUndo={(itemId) =>
                  void run(
                    () => restoreFn({ data: { organizationId: orgId, itemId } }),
                    "Marked as needed again",
                  )
                }
              />
            ))}
          </ul>
        </SectionCard>
      ))}
      {disclaimer}
      {uploading && (
        <EvidenceUploadDialog
          orgId={orgId}
          row={uploading}
          onClose={() => setUploading(null)}
          onSaved={refresh}
        />
      )}
      <NotNeededDialog
        title={waiving?.title ?? null}
        pending={busy}
        onCancel={() => setWaiving(null)}
        onConfirm={(reason) => {
          const itemId = waiving!.itemId;
          setWaiving(null);
          void run(
            () => skipFn({ data: { organizationId: orgId, itemId, reason } }),
            "Marked not needed",
          );
        }}
      />
      {review}
    </div>
  );
}
