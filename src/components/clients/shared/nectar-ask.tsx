// NECTAR-driven ask. The resolution UI is type-driven — not uniformly
// three-path. Only data-rich gaps show an upload option; confident
// suggestions show Confirm/Edit; simple booleans show Yes/None.
//
// Upload: the file is saved to the client's documents straight away
// (storage + client_documents row). For BSP, MAR and DNR / POLST /
// palliative / hospice uploads Nectar then reads the file and shows a review
// list (profile fields and, for a MAR, each medication). Nothing lands in the
// profile or medications until the person ticks rows and clicks Apply
// selected (applySelectedClientFields).
import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Upload, Loader2, Paperclip, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import {
  applySelectedClientFields,
  attachClientDocument,
  previewClientUpdateFromDocument,
} from "@/lib/import-checklist.functions";
import {
  CLIENT_DOCUMENTS_BUCKET,
  clientUploadFolder,
  defaultChecked,
  reviewableUploadType,
} from "@/lib/clients/create/document-review";
import {
  UpdateProposalsList,
  type UpdateProposal,
} from "@/components/clients/dialogs/update-proposals-list";

export type NectarAskKind = "confident_suggestion" | "data_rich_gap" | "simple_yes_no";

export type NectarAskProps = {
  question: string;
  /** Plain-text summary of NECTAR's finding/suggestion, when present. */
  finding?: string | null;
  kind: NectarAskKind;
  /** Required when kind === "data_rich_gap" and Upload is offered. */
  clientId?: string;
  /** Storage document_type when uploading (e.g. "bsp", "immunizations"). */
  uploadDocumentType?: string;
  /** Suggested value to use when user clicks "Confirm" on a confident suggestion. */
  onConfirm?: () => Promise<void> | void;
  /** Yes handler for simple_yes_no kind. */
  onYes?: () => Promise<void> | void;
  /** "No / none" handler (all kinds where rejection makes sense). */
  onNone?: () => Promise<void> | void;
  /** Manual form revealed when "Fill in myself" / "Edit" is clicked. */
  manualForm?: ReactNode;
  /** Optional extra context line (e.g. extraction snippet). */
  context?: string | null;
  /** When set, ask renders in "answered" mode with this summary. */
  answeredSummary?: string | null;
};

type Review = { fileName: string; proposals: UpdateProposal[] };

export function NectarAsk({
  question,
  finding,
  kind,
  clientId,
  uploadDocumentType,
  onConfirm,
  onYes,
  onNone,
  manualForm,
  context,
  answeredSummary,
}: NectarAskProps) {
  const [mode, setMode] = useState<"choose" | "manual">("choose");
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id ?? null;
  const attachFn = useServerFn(attachClientDocument);
  const previewFn = useServerFn(previewClientUpdateFromDocument);
  const applyFn = useServerFn(applySelectedClientFields);

  const refreshClient = () => {
    if (!clientId) return;
    void qc.invalidateQueries({
      predicate: (q) => JSON.stringify(q.queryKey).includes(clientId),
    });
  };

  const apply = useMutation({
    mutationFn: async () => {
      if (!clientId || !review) return { appliedCount: 0 };
      const fields = review.proposals.filter((p) => checked[p.field_key]).map((p) => p.field);
      if (!fields.length) return { appliedCount: 0 };
      return applyFn({ data: { clientId, fields } });
    },
    onSuccess: (res) => {
      const n = (res as { appliedCount?: number })?.appliedCount ?? 0;
      toast.success(
        n > 0
          ? `Applied ${n} item${n === 1 ? "" : "s"} from ${review?.fileName}.`
          : "Nothing selected",
      );
      setReview(null);
      setChecked({});
      refreshClient();
    },
    onError: (e: unknown) =>
      toast.error((e as Error).message || "Couldn't apply the selected items"),
  });

  // The review list wins over everything else until it is applied or dismissed,
  // so a refetch that marks the ask answered can't hide it.
  if (review) {
    const selected = review.proposals.filter((p) => checked[p.field_key]).length;
    return (
      <div className="space-y-3 rounded-md border border-amber-300/60 bg-amber-50/20 p-3 text-sm dark:bg-amber-950/10">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
          <div className="flex-1">
            <div className="font-medium">Review what Nectar read from {review.fileName}</div>
            <div className="text-xs text-muted-foreground">
              The file is saved. Nothing changes on the profile or medication list until you click
              Apply selected.
            </div>
          </div>
        </div>
        <UpdateProposalsList
          proposals={review.proposals}
          checked={checked}
          onCheckedChange={(k, v) => setChecked((c) => ({ ...c, [k]: v }))}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={apply.isPending}
            onClick={() => {
              setReview(null);
              setChecked({});
            }}
          >
            Don't apply anything
          </Button>
          <Button
            size="sm"
            disabled={apply.isPending || selected === 0}
            onClick={() => apply.mutate()}
          >
            {apply.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Apply selected ({selected})
          </Button>
        </div>
      </div>
    );
  }

  if (answeredSummary) {
    return (
      <div className="rounded-md border border-emerald-300/60 bg-emerald-50/30 p-3 text-sm dark:bg-emerald-950/10">
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">{question}</div>
            <div className="mt-0.5 font-medium">{answeredSummary}</div>
            {attachedFile && (
              <div className="mt-1 text-xs text-muted-foreground">
                <Paperclip className="mr-1 inline h-3 w-3" />
                {attachedFile} · attached to profile
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="text-xs text-primary hover:underline"
          >
            <Pencil className="mr-1 inline h-3 w-3" />
            Edit
          </button>
        </div>
        {mode === "manual" && manualForm && (
          <div className="mt-3 border-t border-emerald-300/40 pt-3">{manualForm}</div>
        )}
      </div>
    );
  }

  const wrap = async (label: string, fn?: () => Promise<void> | void) => {
    if (!fn) return;
    try {
      setBusy(label);
      await fn();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed");
    } finally {
      setBusy(null);
    }
  };

  const onUpload: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
    const f = ev.target.files?.[0];
    if (!f || !clientId || !uploadDocumentType) return;
    if (!orgId) {
      toast.error("Your agency is still loading. Try again in a moment.");
      return;
    }
    try {
      setBusy("upload");
      const safeName = f.name.replace(/[^\w.-]+/g, "_");
      const path = `${clientUploadFolder(orgId, clientId, uploadDocumentType)}${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from(CLIENT_DOCUMENTS_BUCKET)
        .upload(path, f, { upsert: false, contentType: f.type });
      if (error) throw error;
      await attachFn({
        data: { clientId, documentType: uploadDocumentType, fileName: f.name, storagePath: path },
      });
      setAttachedFile(f.name);
      refreshClient();

      // Nectar reads the saved file and proposes values; the person reviews them.
      const docType = reviewableUploadType(uploadDocumentType);
      if (!docType) {
        toast.success(`${f.name} attached to profile.`);
        setMode("manual");
        return;
      }
      try {
        const res = await previewFn({
          data: { clientId, documentType: docType, fileName: f.name, storagePath: path },
        });
        if (!res.ok) {
          toast.success(`${f.name} attached. ${res.reason}`);
          setMode("manual");
        } else if (res.proposals.length === 0) {
          toast.success(`${f.name} attached. Nectar didn't find anything to add from it.`);
          setMode("manual");
        } else {
          setReview({ fileName: f.name, proposals: res.proposals });
          setChecked(defaultChecked(res.proposals));
        }
      } catch (e) {
        toast.success(`${f.name} attached. Nectar couldn't read it: ${(e as Error).message}`);
        setMode("manual");
      }
    } catch (e) {
      toast.error((e as Error).message ?? "Upload failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-md border border-amber-300/60 bg-amber-50/20 p-3 text-sm dark:bg-amber-950/10">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
        <div className="flex-1 space-y-1">
          <div className="font-medium">{question}</div>
          {finding && (
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-primary">NECTAR:</span> {finding}
            </div>
          )}
          {context && <div className="text-xs text-muted-foreground">{context}</div>}
        </div>
      </div>

      {mode === "choose" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {kind === "confident_suggestion" && (
            <>
              <Button size="sm" disabled={!!busy} onClick={() => wrap("confirm", onConfirm)}>
                {busy === "confirm" ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3 w-3" />
                )}
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => setMode("manual")}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit
              </Button>
            </>
          )}

          {kind === "data_rich_gap" && (
            <>
              <Button size="sm" disabled={!!busy} onClick={() => setMode("manual")}>
                Fill in myself
              </Button>
              {clientId && uploadDocumentType && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!busy || !orgId}
                    onClick={() => fileRef.current?.click()}
                  >
                    {busy === "upload" ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="mr-1 h-3 w-3" />
                    )}
                    Upload document
                  </Button>
                  <input ref={fileRef} type="file" className="hidden" onChange={onUpload} />
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={!!busy}
                onClick={() => wrap("none", onNone)}
              >
                {busy === "none" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                No / none
              </Button>
            </>
          )}

          {kind === "simple_yes_no" && (
            <>
              <Button size="sm" disabled={!!busy} onClick={() => wrap("yes", onYes)}>
                {busy === "yes" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Yes
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => wrap("none", onNone)}
              >
                {busy === "none" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                No / none
              </Button>
            </>
          )}
        </div>
      )}

      {attachedFile && mode === "manual" && (
        <div className="mt-2 inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
          <Paperclip className="h-3 w-3" /> {attachedFile} · attached
          <Badge variant="outline" className="ml-1 text-[10px]">
            Nothing applied from it
          </Badge>
        </div>
      )}

      {mode === "manual" && manualForm && (
        <div className="mt-3 border-t border-amber-300/40 pt-3">{manualForm}</div>
      )}
    </div>
  );
}
