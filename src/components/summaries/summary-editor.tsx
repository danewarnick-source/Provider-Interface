// The progress summary editor: source documentation on the left, the
// summary as a document on the right (goals → supports → progress →
// evidence, incidents, general notes), autosaved as it is typed. Nectar is a
// helper, never a gate: "Draft with Nectar" on each box, "Draft all boxes"
// and an optional "Review with Nectar" at the top, a small Reminders list;
// "View & download" (preview + PDF); Finalize (it asks first when a goal is
// blank, and blocks on nothing but the period not being over); and the
// filing attestations. /dashboard/summaries opens it as a dialog; the client
// profile's Progress summaries card opens the same editor as a side panel.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canFinalizeSummary,
  finalizeOpensMessage,
  summaryCadenceLabel,
} from "@/lib/progress-summaries";
import type { SummaryDoc } from "@/lib/progress-summary-doc";
import { fieldText, visibleSuggestion, type FieldKey } from "@/lib/progress-summary-review";
import { EmploymentAttestation } from "./employment-attestation";
import { EditorShell } from "./editor-shell";
import { FinalizeDialog } from "./finalize-dialog";
import { SummaryDocument } from "./summary-document";
import { reopenEventLine } from "@/lib/progress-summary-reopen";
import { ReopenDialog } from "./reopen-dialog";
import { BlankGoalsDialog } from "./blank-goals-dialog";
import { BoxTools, RemindersList } from "./summary-review-panel";
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
    blank,
    bundleQ,
    canDraft,
    doc,
    draftAll,
    draftBox,
    draftMut,
    editor,
    hasRecords,
    hideKey,
    hideSuggestion,
    nectarMut,
    reminders,
    reopenMut,
    review,
    reviewOp,
    undo,
    undoStacks,
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
  const [reopening, setReopening] = useState(false);
  const [confirmBlank, setConfirmBlank] = useState(false);
  const b = bundleQ.data;
  const close = () => void flush().finally(onClose);
  const goalNames = useMemo(
    () => Object.fromEntries((b?.goals ?? []).map((g) => [g.id, g.goal])),
    [b?.goals],
  );
  const busy = nectarMut.isPending || draftMut.isPending || reviewOp.isPending;
  const finalizeOpen = !b || canFinalizeSummary(b.summary.period_end);
  const renderReview = (field: FieldKey) => (
    <BoxTools
      field={field}
      current={editor ? fieldText(editor, field) : ""}
      suggestion={visibleSuggestion(review, field)}
      canUndo={(undoStacks[field]?.length ?? 0) > 0}
      canDraft={canDraft(field)}
      drafting={draftMut.isPending && !!draftMut.variables?.includes(field)}
      busy={busy}
      onDraft={(f) => void flush().then(() => draftBox(f))}
      onAccept={accept}
      onUndo={undo}
      onHideSuggestion={hideSuggestion}
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
                  if (!finalizeOpen) {
                    toast.info(finalizeOpensMessage(b.summary.period_end));
                    return;
                  }
                  setEditor((p) => (p ? { ...p, general: PBA_TEXT } : p));
                  setAiAttested(true);
                  setShowFinalize(true);
                }}
              />
            ) : draftMut.isPending || nectarMut.isPending ? (
              <div className="rounded border bg-blue-50 px-3 py-2 text-sm text-blue-800 flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />{" "}
                {draftMut.isPending ? "Nectar is drafting…" : "Nectar is reviewing…"}
              </div>
            ) : null}
            {!locked && !hasRecords && b.summary.summary_kind === "narrative" ? (
              <p className="rounded border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                No approved daily logs, shift notes or incidents this period.
              </p>
            ) : null}
            {!locked && b.summary.summary_kind === "narrative" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void flush().then(() => draftAll())}
                  disabled={busy}
                  data-testid="summary-draft-all"
                >
                  <Sparkles className="size-4 mr-1" /> Draft all boxes
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void flush().then(() => nectarMut.mutate())}
                  disabled={busy}
                  data-testid="summary-draft-nectar"
                >
                  Review with Nectar
                </Button>
              </div>
            ) : null}
            {!locked ? <RemindersList reminders={reminders} onHide={hideKey} /> : null}

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
                          disabled: draftMut.isPending || nectarMut.isPending || finalizeMut.isPending,
                          review: renderReview,
                        }
                  }
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
                    <Eye className="size-4 mr-1" /> View &amp; download
                  </Button>
                  {!locked && (
                    <Button
                      size="sm"
                      onClick={() => {
                        void flush().then(() => (blank.length ? setConfirmBlank(true) : setShowFinalize(true)));
                      }}
                      disabled={!finalizeOpen}
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
                  {locked && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReopening(true)}
                      data-testid="summary-reopen"
                    >
                      <RotateCcw className="size-4 mr-1" /> Reopen for edits
                    </Button>
                  )}
                  {!locked && !finalizeOpen && (
                    <span className="text-xs text-muted-foreground" data-testid="summary-finalize-opens">
                      {finalizeOpensMessage(b.summary.period_end)}
                    </span>
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

            {b.reopens.length > 0 && (
              <div className="space-y-0.5 text-xs text-muted-foreground" data-testid="summary-reopens">
                {b.reopens.map((e) => (
                  <p key={e.at}>{reopenEventLine(e)}</p>
                ))}
              </div>
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

      {reopening && b && (
        <ReopenDialog
          attested={b.summary.upi_entered_at ? "upi" : b.summary.sc_sent_at ? "sc" : null}
          pending={reopenMut.isPending}
          onCancel={() => setReopening(false)}
          onReopen={(reason) => reopenMut.mutate(reason, { onSuccess: () => setReopening(false) })}
        />
      )}

      {confirmBlank && (
        <BlankGoalsDialog
          goals={blank.map((g) => g.goal)}
          onBack={() => setConfirmBlank(false)}
          onContinue={() => {
            setConfirmBlank(false);
            setShowFinalize(true);
          }}
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
