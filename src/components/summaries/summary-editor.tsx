// The progress summary editor: source documentation on the left, the
// summary as a document on the right (goals → supports → progress →
// evidence, incidents, general notes), autosaved as it is typed. One Nectar
// button ("Draft with Nectar" when the period has records, "Review with
// Nectar" when it has none) whose findings and suggested rewrites show under
// each field; "View & download" (preview + PDF); Finalize, blocked while a
// finding is open; and the filing attestations. /dashboard/summaries opens it as a dialog; the client
// profile's Progress summaries card opens the same editor as a side panel.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, Eye, FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { summaryCadenceLabel } from "@/lib/progress-summaries";
import type { SummaryDoc } from "@/lib/progress-summary-doc";
import type { FieldKey } from "@/lib/progress-summary-review";
import { EmploymentAttestation } from "./employment-attestation";
import { EditorShell } from "./editor-shell";
import { FinalizeDialog } from "./finalize-dialog";
import { SummaryDocument } from "./summary-document";
import { FieldReview } from "./summary-review-panel";
import { PbaPanel, SourcePanel } from "./summary-source-panel";
import { useSummaryEditor, type SaveState } from "./use-summary-editor";

const PBA_TEXT = "Monthly financial statement generated and sent to Support Coordinator.";

const SAVE_LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

function PreviewDialog({
  doc,
  onClose,
  onDownload,
}: {
  doc: SummaryDoc;
  onClose: () => void;
  onDownload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Progress summary</DialogTitle>
          <DialogDescription>The document as the PDF prints it.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SummaryDocument doc={doc} />
        </div>
        <DialogFooter className="max-md:[&_button]:min-h-11">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onDownload().finally(() => setBusy(false));
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SummaryEditor({
  summaryId,
  organizationId,
  orgName,
  clientName,
  onClose,
  panel = false,
}: {
  summaryId: string;
  organizationId: string;
  orgName: string | null;
  clientName: string;
  onClose: () => void;
  /** Open as a side panel (client profile) instead of a dialog (/dashboard/summaries). */
  panel?: boolean;
}) {
  const {
    accept,
    aiAttested,
    bundleQ,
    dismiss,
    doc,
    editor,
    hasRecords,
    keep,
    nectarMut,
    open,
    review,
    reviewOp,
    shown,
    filing,
    finalizeMut,
    finalizerName,
    flush,
    handleDownload,
    locked,
    saveState,
    scMut,
    setAiAttested,
    setEditor,
    setFinalizerName,
    setShowFinalize,
    showFinalize,
    upiMut,
  } = useSummaryEditor({ summaryId, organizationId, orgName, clientName });
  const [preview, setPreview] = useState(false);
  const b = bundleQ.data;
  const close = () => void flush().finally(onClose);
  const goalNames = useMemo(
    () => Object.fromEntries((b?.goals ?? []).map((g) => [g.id, g.goal])),
    [b?.goals],
  );
  const busy = nectarMut.isPending || reviewOp.isPending;
  const renderReview = (field: FieldKey) => (
    <FieldReview
      field={field}
      findings={shown.filter((f) => f.field === field)}
      dismissals={review.dismissals}
      suggestion={review.suggestions.find((x) => x.field === field) ?? null}
      goalNames={goalNames}
      busy={busy}
      onAccept={accept}
      onKeepMine={keep}
      onDismiss={dismiss}
    />
  );

  return (
    <EditorShell panel={panel} onClose={close}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="size-5" /> {clientName} —{" "}
          {b?.summary.period_label.replace(/-FS$/, "")}
        </DialogTitle>
        <DialogDescription>
          {b ? summaryCadenceLabel(b.summary.period_kind, b.summary.service_codes) : "Loading…"}
        </DialogDescription>
      </DialogHeader>

      {bundleQ.isLoading || !b || !editor || !doc ? (
        <div className="py-12 text-center">
          <Loader2 className="size-5 animate-spin inline" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-0">
          <div className="overflow-y-auto pr-2 space-y-3 border-r min-h-0">
            <SourcePanel bundle={b} />
          </div>

          <div
            className="overflow-y-auto pl-2 flex flex-col gap-3 min-h-0"
            onBlur={() => void flush()}
          >
            {b.summary.summary_kind === "financial_statement" ? (
              <PbaPanel
                status={b.summary.status}
                onMarkComplete={() => {
                  setEditor((p) => (p ? { ...p, general: PBA_TEXT } : p));
                  setAiAttested(true);
                  setShowFinalize(true);
                }}
              />
            ) : nectarMut.isPending ? (
              <div className="rounded border bg-blue-50 px-3 py-2 text-sm text-blue-800 flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />{" "}
                {hasRecords
                  ? "Nectar is drafting from your text and this period's records…"
                  : "Nectar is reviewing your text…"}
              </div>
            ) : !locked && !hasRecords ? (
              <p className="rounded border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                No approved daily logs, shift notes or incidents this period. Type the summary, then
                Review with Nectar.
              </p>
            ) : null}
            {!locked && b.summary.summary_kind === "narrative" && open.length > 0 ? (
              <p
                className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                data-testid="summary-open-findings"
              >
                {open.length} item{open.length === 1 ? "" : "s"} to resolve before Finalize. Fix each
                one or choose Keep as is.
              </p>
            ) : null}

            {b.summary.summary_kind === "narrative" && (
              <>
                <SummaryDocument
                  doc={doc}
                  edit={
                    locked
                      ? undefined
                      : {
                          editor,
                          setEditor: (fn) => setEditor((p) => (p ? fn(p) : p)),
                          goalIds: b.summary.include_goal_progress ? b.goals.map((g) => g.id) : [],
                          disabled: nectarMut.isPending || finalizeMut.isPending,
                          review: renderReview,
                        }
                  }
                />

                <div className="flex flex-wrap items-center gap-2">
                  {!locked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void flush().then(() => nectarMut.mutate())}
                      disabled={busy}
                      data-testid="summary-draft-nectar"
                    >
                      <Sparkles className="size-4 mr-1" />{" "}
                      {hasRecords ? "Draft with Nectar" : "Review with Nectar"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
                    <Eye className="size-4 mr-1" /> View &amp; download
                  </Button>
                  {!locked && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (open.length) {
                          toast.error(
                            `Resolve ${open.length} item${open.length === 1 ? "" : "s"} first: fix each one or choose Keep as is.`,
                          );
                          return;
                        }
                        void flush().then(() => setShowFinalize(true));
                      }}
                      data-testid="summary-finalize"
                    >
                      <CheckCircle2 className="size-4 mr-1" /> Finalize
                    </Button>
                  )}
                  {locked && filing === "upi" && !b.summary.upi_entered_at && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => upiMut.mutate()}
                      disabled={upiMut.isPending}
                    >
                      Mark entered in UPI
                    </Button>
                  )}
                  {locked && filing === "support_coordinator" && !b.summary.sc_sent_at && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => scMut.mutate()}
                      disabled={scMut.isPending}
                    >
                      Mark sent to Support Coordinator
                    </Button>
                  )}
                  {!locked && saveState !== "idle" && (
                    <span
                      className={`text-xs ${saveState === "error" ? "text-hive-danger" : "text-muted-foreground"}`}
                      data-testid="summary-save-state"
                    >
                      {SAVE_LABEL[saveState]}
                    </span>
                  )}
                </div>
              </>
            )}

            <EmploymentAttestation organizationId={organizationId} summary={b.summary} />
          </div>
        </div>
      )}

      {preview && doc && (
        <PreviewDialog
          doc={doc}
          onClose={() => setPreview(false)}
          onDownload={() => handleDownload()}
        />
      )}

      {showFinalize && (
        <FinalizeDialog
          finalizerName={finalizerName}
          setFinalizerName={setFinalizerName}
          aiAttested={aiAttested}
          setAiAttested={setAiAttested}
          pending={finalizeMut.isPending}
          onCancel={() => setShowFinalize(false)}
          onFinalize={() => finalizeMut.mutate()}
        />
      )}
    </EditorShell>
  );
}
