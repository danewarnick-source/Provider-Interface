// "Update from a document" (profile ⋯ menu): upload a 1056 or intake
// document, Nectar proposes field updates, the person reviews them against
// the current values and applies only the ones they tick. A PCSP goes
// through "Upload PCSP" (review → Confirm) instead.

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applySelectedClientFields,
  previewClientUpdateFromDocument,
} from "@/lib/import-checklist.functions";
import { UpdateProposalsList, type UpdateProposal } from "./update-proposals-list";

type DocType = "1056_budget" | "other";

export function UpdateFromDocumentDialog({
  open,
  onOpenChange,
  clientId,
  orgId,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  orgId: string;
  onApplied: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<DocType>("1056_budget");
  const [busy, setBusy] = useState<"uploading" | "reading" | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [proposals, setProposals] = useState<UpdateProposal[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const previewFn = useServerFn(previewClientUpdateFromDocument);
  const applyFn = useServerFn(applySelectedClientFields);

  const reset = () => {
    setProposals(null);
    setReason(null);
    setChecked({});
    setBusy(null);
  };
  const close = () => {
    onOpenChange(false);
    reset();
  };

  const onPickFile = async (file: File) => {
    reset();
    setBusy("uploading");
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const storagePath = `${orgId}/${clientId}/update/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("client-documents")
        .upload(storagePath, file, { upsert: false });
      if (error) throw error;
      setBusy("reading");
      const res = await previewFn({
        data: { clientId, documentType, fileName: file.name, storagePath },
      });
      if (!res.ok) {
        setReason(res.reason);
      } else {
        setProposals(res.proposals);
        setChecked(
          Object.fromEntries(
            res.proposals.map((p) => [p.field_key, p.changed && !!p.incomingValue]),
          ),
        );
      }
    } catch (e) {
      setReason((e as Error).message || "Upload or reading failed.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const apply = useMutation({
    mutationFn: async () => {
      const fields = (proposals ?? []).filter((p) => checked[p.field_key]).map((p) => p.field);
      if (!fields.length) return { appliedCount: 0 };
      return applyFn({ data: { clientId, fields } });
    },
    onSuccess: (res) => {
      const n = (res as { appliedCount?: number })?.appliedCount ?? 0;
      toast.success(n > 0 ? `Profile updated (${n} fields applied)` : "Nothing selected");
      onApplied();
      close();
    },
    onError: (e: unknown) => toast.error((e as Error).message || "Failed to apply updates"),
  });

  const selectedCount = (proposals ?? []).filter((p) => checked[p.field_key]).length;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update from a document</DialogTitle>
          <DialogDescription>
            Nectar reads the document and proposes updates. Nothing changes until you click "Apply
            selected".
          </DialogDescription>
        </DialogHeader>

        {!proposals && !reason ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="update-doc-type">
                Document type
              </Label>
              <select
                id="update-doc-type"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocType)}
                disabled={busy !== null}
              >
                <option value="1056_budget">1056</option>
                <option value="other">Intake / other</option>
              </select>
              <p className="text-xs text-muted-foreground">For a PCSP, use Upload PCSP.</p>
            </div>
            <div className="rounded-md border border-dashed p-6 text-center">
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickFile(f);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={busy !== null}
              >
                {busy ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-4 w-4" />
                )}
                {busy === "uploading"
                  ? "Uploading…"
                  : busy === "reading"
                    ? "Reading…"
                    : "Choose document"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">PDF, DOCX, or TXT</p>
            </div>
          </div>
        ) : null}

        {reason ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>{reason}</div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setReason(null)}>
                Try another file
              </Button>
              <Button size="sm" onClick={close}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {proposals ? (
          <div className="space-y-3">
            <UpdateProposalsList
              proposals={proposals}
              checked={checked}
              onCheckedChange={(k, v) => setChecked((c) => ({ ...c, [k]: v }))}
            />
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => apply.mutate()}
                disabled={apply.isPending || selectedCount === 0}
              >
                {apply.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Apply selected ({selectedCount})
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
