// The monthly budget's PDF buttons (preview, download, print, save to the
// client file) and the preview window.

import { CheckCircle2, Eye, FileText, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { useBudgetPdf } from "./use-budget-pdf";

export function BudgetPdfBar({
  pdf,
  periodLabel,
  clientName,
  canEdit,
  dirty,
  saving,
  onSave,
}: {
  pdf: ReturnType<typeof useBudgetPdf>;
  periodLabel: string;
  clientName: string;
  canEdit: boolean;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const latest = pdf.shipped[0] ?? null;
  const busy = pdf.busy !== null;
  const label = (mode: typeof pdf.busy, idle: string) => (pdf.busy === mode ? "Building…" : idle);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {latest ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Saved to client file {new Date(latest.uploaded_at).toLocaleDateString()}
              {pdf.shipped.length > 1 ? ` (${pdf.shipped.length} copies)` : ""}
            </span>
          ) : (
            <span>Not yet saved to the client file for {periodLabel}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={pdf.preview} disabled={busy}>
            <Eye className="mr-2 h-4 w-4" />
            {label("preview", "Preview")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => pdf.open("download")} disabled={busy}>
            <FileText className="mr-2 h-4 w-4" />
            {label("download", "Download PDF")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => pdf.open("print")} disabled={busy}>
            <Printer className="mr-2 h-4 w-4" />
            {label("print", "Print")}
          </Button>
          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={pdf.ship}
              disabled={busy || dirty}
              title={dirty ? "Save your changes first" : "Save a finished copy to the client file"}
            >
              <Send className="mr-2 h-4 w-4" />
              {pdf.busy === "ship" ? "Saving…" : "Save to client file"}
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={pdf.previewUrl !== null}
        onOpenChange={(o) => {
          if (!o) pdf.closePreview();
        }}
      >
        <DialogContent className="flex h-[90vh] w-[95vw] max-w-5xl flex-col gap-0 p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-base">
              Budget preview — {clientName} · {periodLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-muted">
            {pdf.previewUrl && (
              <iframe
                src={pdf.previewUrl}
                title="Budget PDF preview"
                className="h-full w-full border-0"
              />
            )}
          </div>
          <DialogFooter className="gap-2 border-t px-4 py-3 sm:justify-between">
            <div className="text-xs text-muted-foreground">Preview only — nothing is saved.</div>
            <Button size="sm" variant="secondary" onClick={pdf.closePreview}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
