// Team member file — reads Evidence only (evidence_items / evidence_files for
// subject 'staff'), through the same status helpers the Evidence page and the
// roster use. Skips are kept on record (who / when / why) and can be restored;
// the team member's own uploads wait here for Accept / Send back.
// The old obligations file lives read-only in <OlderRecords> at the bottom.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { denverYmd } from "@/lib/denver-date";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EvidenceStatusChip } from "@/components/evidence/evidence-status-chip";
import { SkipEvidenceDialog } from "@/components/evidence/skip-evidence-dialog";
import {
  recordEvidenceUpload,
  removeEvidenceRequirement,
  restoreEvidenceRequirement,
  reviewEvidenceFile,
} from "@/lib/evidence.functions";
import { effectiveAttentionDate } from "@/lib/evidence/due";
import {
  cellStatus,
  itemHasCompletedEvidence,
  latestFileForItem,
  matrixChip,
} from "@/lib/evidence/status";
import type { EvidenceFileRow, EvidenceItemRow } from "@/lib/evidence/types";
import { formatLocalDate } from "@/lib/team-members/badges";
import { OlderRecords } from "@/components/team-members/profile/older-records";

type Row = {
  item: EvidenceItemRow;
  file: EvidenceFileRow | null;
  status: ReturnType<typeof cellStatus>;
  chip: ReturnType<typeof matrixChip>;
  due: string | null;
};

function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function guessIsImage(filename: string | null): boolean {
  return !!filename && /\.(png|jpe?g|gif|webp|bmp)$/i.test(filename);
}

async function signedEvidenceUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("evidence-files").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not open file");
  return data.signedUrl;
}

export function StaffObligationsFilesTab({
  organizationId,
  staffId,
  staffName,
  items,
  files,
  names,
  onChanged,
  onReviewEvidence,
}: {
  organizationId: string;
  staffId: string;
  staffName: string;
  items: EvidenceItemRow[];
  files: EvidenceFileRow[];
  /** user id → display name (from the profile loader). */
  names: Record<string, string>;
  onChanged: () => void;
  onReviewEvidence: () => void;
}) {
  const qc = useQueryClient();
  const { canCategory, isAdminLevel } = useAccess();
  const canEdit = canCategory("staff_compliance", "edit");
  // Skip / Restore run as Admin-level server calls.
  const canSkip = canEdit && isAdminLevel;
  const canReviewPack = canCategory("staff_hiring", "edit");

  const uploadFn = useServerFn(recordEvidenceUpload);
  const skipFn = useServerFn(removeEvidenceRequirement);
  const restoreFn = useServerFn(restoreEvidenceRequirement);
  const reviewFn = useServerFn(reviewEvidenceFile);

  const [uploadItem, setUploadItem] = useState<EvidenceItemRow | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [viewRow, setViewRow] = useState<Row | null>(null);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [skipItem, setSkipItem] = useState<EvidenceItemRow | null>(null);
  const [sendBackFile, setSendBackFile] = useState<{ file: EvidenceFileRow; title: string } | null>(
    null,
  );
  const [sendBackNote, setSendBackNote] = useState("");
  const [showSkipped, setShowSkipped] = useState(false);

  const nameOf = (id: string | null | undefined): string => {
    if (!id) return "Someone";
    if (id === staffId) return staffName;
    return names[id] ?? "Someone";
  };

  const today = denverYmd();
  const { active, skipped } = useMemo(() => {
    const act: Row[] = [];
    const skip: EvidenceItemRow[] = [];
    for (const item of items) {
      const file = latestFileForItem(files, item.id);
      const status = cellStatus({ item, file, today });
      if (status === "skipped") {
        skip.push(item);
        continue;
      }
      act.push({
        item,
        file,
        status,
        chip: matrixChip({ item, file, today }),
        due: effectiveAttentionDate({
          hasFile: itemHasCompletedEvidence(item, file),
          firstDueOn: item.first_due_on,
          nextDueOn: item.next_due_on,
          expiresOn: item.expires_on,
        }),
      });
    }
    act.sort((a, b) => a.item.title.localeCompare(b.item.title));
    skip.sort((a, b) => (b.opted_out_at ?? "").localeCompare(a.opted_out_at ?? ""));
    return { active: act, skipped: skip };
  }, [items, files, today]);

  const awaiting = active.filter((r) => r.status === "awaiting_review").length;

  useEffect(() => {
    const path = viewRow?.file?.storage_path;
    if (!path) {
      setViewUrl(null);
      return;
    }
    let cancelled = false;
    setViewUrl(null);
    signedEvidenceUrl(path)
      .then((url) => {
        if (!cancelled) setViewUrl(url);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Could not open file");
      });
    return () => {
      cancelled = true;
    };
  }, [viewRow]);

  const refresh = () => {
    onChanged();
    void qc.invalidateQueries({ queryKey: ["evidence-board", organizationId] });
  };
  const onError = (e: Error) => toast.error(e.message);

  const uploadM = useMutation({
    mutationFn: async () => {
      if (!uploadItem) throw new Error("Choose an item.");
      if (!uploadFile) throw new Error("Choose a file to upload.");
      const safe = uploadFile.name.replace(/[^\w.-]+/g, "_");
      const path = `${organizationId}/${uploadItem.id}/${Date.now()}-${safe}`;
      const up = await supabase.storage
        .from("evidence-files")
        .upload(path, uploadFile, { upsert: true });
      if (up.error) throw new Error(up.error.message);
      await uploadFn({
        data: {
          organizationId,
          itemId: uploadItem.id,
          storagePath: path,
          filename: uploadFile.name,
        },
      });
    },
    onSuccess: () => {
      toast.success("Upload saved.");
      setUploadItem(null);
      setUploadFile(null);
      refresh();
    },
    onError,
  });

  const skipM = useMutation({
    mutationFn: (args: { itemId: string; reason: string }) =>
      skipFn({ data: { organizationId, ...args } }),
    onSuccess: () => {
      toast.success("Item skipped. It stays on record and can be restored.");
      setSkipItem(null);
      refresh();
    },
    onError,
  });

  const restoreM = useMutation({
    mutationFn: (itemId: string) => restoreFn({ data: { organizationId, itemId } }),
    onSuccess: () => {
      toast.success("Item restored.");
      refresh();
    },
    onError,
  });

  const reviewM = useMutation({
    mutationFn: (args: { fileId: string; decision: "accepted" | "sent_back"; note?: string }) =>
      reviewFn({ data: { organizationId, ...args } }),
    onSuccess: (_res, args) => {
      toast.success(args.decision === "accepted" ? "Accepted." : "Sent back to the team member.");
      setSendBackFile(null);
      setSendBackNote("");
      refresh();
    },
    onError,
  });

  const busy = uploadM.isPending || skipM.isPending || restoreM.isPending || reviewM.isPending;

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <section
          className="rounded-2xl border border-dashed border-border bg-card p-6 text-center"
          data-testid="no-evidence-pack"
        >
          <p className="font-medium">No evidence pack yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the evidence pack to choose which records this team member needs.
          </p>
          {canReviewPack ? (
            <Button className="mt-3" size="sm" onClick={onReviewEvidence}>
              Review evidence pack
            </Button>
          ) : null}
        </section>
        <OlderRecords organizationId={organizationId} staffId={staffId} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="team-member-file">
      {awaiting > 0 ? (
        <p className="text-sm text-sky-800">
          {awaiting} upload{awaiting === 1 ? "" : "s"} awaiting review.
        </p>
      ) : null}

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Every item on this file is skipped.{" "}
          {canReviewPack ? (
            <Button variant="link" className="h-auto p-0" onClick={onReviewEvidence}>
              Review evidence pack
            </Button>
          ) : null}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Due</th>
                <th className="px-3 py-2 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {active.map((row) => {
                const { item, file, status } = row;
                const chip =
                  row.chip.kind === "review"
                    ? { ...row.chip, label: "Sent to team member" }
                    : row.chip;
                const isUpload = item.evidence_type === "upload";
                return (
                  <tr key={item.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{item.title}</p>
                      {file?.filename ? (
                        <p className="text-xs text-muted-foreground">{file.filename}</p>
                      ) : null}
                      {!isUpload ? (
                        <p className="text-xs text-muted-foreground">
                          Team member attests themselves
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <EvidenceStatusChip chip={chip} ariaLabel={`${item.title}: ${chip.label}`} />
                      {status === "awaiting_review" && file ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Uploaded by {nameOf(file.uploaded_by)}
                          {file.uploaded_at ? ` on ${formatStamp(file.uploaded_at)}` : ""}
                        </p>
                      ) : null}
                      {status === "sent_back" && file ? (
                        <p className="mt-1 max-w-xs text-xs text-amber-900">
                          Sent back by {nameOf(file.reviewed_by)}
                          {file.reviewed_at ? ` on ${formatStamp(file.reviewed_at)}` : ""}
                          {file.review_note ? `: ${file.review_note}` : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatLocalDate(row.due) || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {canEdit && isUpload ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              setUploadFile(null);
                              setUploadItem(item);
                            }}
                          >
                            <Upload className="mr-1 h-3.5 w-3.5" />
                            Upload
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!file || (!file.storage_path && !file.attested_at)}
                          onClick={() => setViewRow(row)}
                        >
                          View
                        </Button>
                        {canEdit && status === "awaiting_review" && file ? (
                          <>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                reviewM.mutate({ fileId: file.id, decision: "accepted" })
                              }
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setSendBackNote("");
                                setSendBackFile({ file, title: item.title });
                              }}
                            >
                              Send back
                            </Button>
                          </>
                        ) : null}
                        {canSkip ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setSkipItem(item)}
                          >
                            Skip
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {skipped.length > 0 ? (
        <section className="rounded-lg border border-border" data-testid="skipped-items">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
            aria-expanded={showSkipped}
            onClick={() => setShowSkipped((v) => !v)}
          >
            {showSkipped ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Skipped ({skipped.length})
          </button>
          {showSkipped ? (
            <ul className="divide-y border-t">
              {skipped.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Skipped by {nameOf(item.opted_out_by)}
                      {item.opted_out_at ? ` on ${formatStamp(item.opted_out_at)}` : ""}
                    </p>
                    {item.opt_out_reason ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-xs">
                        Reason: {item.opt_out_reason}
                      </p>
                    ) : null}
                  </div>
                  {canSkip ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => restoreM.mutate(item.id)}
                    >
                      Restore
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <OlderRecords organizationId={organizationId} staffId={staffId} />

      <Dialog
        open={!!uploadItem}
        onOpenChange={(open) => {
          if (!open) setUploadItem(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload — {uploadItem?.title}</DialogTitle>
            <DialogDescription>
              Files you add for a team member are accepted right away (your own wait for review).
              Earlier files stay on record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="evidence-file">File</Label>
            <input
              id="evidence-file"
              type="file"
              className="block w-full text-sm"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUploadItem(null)}>
              Cancel
            </Button>
            <Button disabled={!uploadFile || uploadM.isPending} onClick={() => uploadM.mutate()}>
              {uploadM.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewRow}
        onOpenChange={(open) => {
          if (!open) setViewRow(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewRow?.item.title ?? "Evidence"}</DialogTitle>
            <DialogDescription>
              {viewRow?.file?.filename ??
                (viewRow?.file?.attested_at
                  ? `Attested by ${nameOf(viewRow.file.attested_by)} on ${formatStamp(viewRow.file.attested_at)}`
                  : "")}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[40vh] rounded-md border border-border bg-muted/20">
            {viewRow?.file && !viewRow.file.storage_path ? (
              <p className="whitespace-pre-wrap p-4 text-sm">
                {viewRow.file.attestation_text_snapshot ?? "Attested."}
              </p>
            ) : !viewUrl ? (
              <p className="p-6 text-sm text-muted-foreground">Loading file…</p>
            ) : guessIsImage(viewRow?.file?.filename ?? null) ? (
              <img src={viewUrl} alt="" className="max-h-[70vh] w-full object-contain" />
            ) : (
              <iframe title="Evidence file" src={viewUrl} className="h-[70vh] w-full border-0" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!sendBackFile}
        onOpenChange={(open) => {
          if (!open) setSendBackFile(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send back — {sendBackFile?.title}</DialogTitle>
            <DialogDescription>
              Tell the team member what to fix. They'll see this note with the item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="send-back-note">Note</Label>
            <Textarea
              id="send-back-note"
              rows={3}
              maxLength={2000}
              value={sendBackNote}
              onChange={(e) => setSendBackNote(e.target.value)}
              placeholder="e.g. The card is expired — please upload the renewed one."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendBackFile(null)}>
              Cancel
            </Button>
            <Button
              disabled={!sendBackNote.trim() || reviewM.isPending}
              onClick={() =>
                sendBackFile &&
                reviewM.mutate({
                  fileId: sendBackFile.file.id,
                  decision: "sent_back",
                  note: sendBackNote.trim(),
                })
              }
            >
              {reviewM.isPending ? "Sending…" : "Send back"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SkipEvidenceDialog
        item={skipItem}
        pending={skipM.isPending}
        onCancel={() => setSkipItem(null)}
        onConfirm={(reason) => {
          if (skipItem) skipM.mutate({ itemId: skipItem.id, reason });
        }}
      />
    </div>
  );
}
