// The progress summary editor: source documentation on the left, the
// summary (Nectar draft, goal progress, finalize, filing attestations) on the
// right. /dashboard/summaries opens it as a dialog; the client profile's
// Progress summaries card opens the same editor as a side panel.

import { CheckCircle2, Download, FileText, Loader2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { summaryCadenceLabel } from "@/lib/progress-summaries";
import { EmploymentAttestation } from "./employment-attestation";
import { EditorShell } from "./editor-shell";
import { FinalizeDialog } from "./finalize-dialog";
import { NoSourceBanner, PbaPanel, SourcePanel } from "./summary-source-panel";
import { useSummaryEditor } from "./use-summary-editor";

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
    aiAttested,
    bundleQ,
    content,
    draftMut,
    filing,
    finalizeMut,
    finalizerName,
    generalDraft,
    goalDrafts,
    handleDownload,
    locked,
    saveMut,
    scMut,
    setAiAttested,
    setContent,
    setFinalizerName,
    setGeneralDraft,
    setGoalDrafts,
    setShowFinalize,
    showFinalize,
    upiMut,
  } = useSummaryEditor({ summaryId, organizationId, orgName, clientName });

  return (
    <EditorShell panel={panel} onClose={onClose}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="size-5" /> {clientName} —{" "}
          {bundleQ.data?.summary.period_label.replace(/-FS$/, "")}
        </DialogTitle>
        <DialogDescription>
          {bundleQ.data
            ? summaryCadenceLabel(
                bundleQ.data.summary.period_kind,
                bundleQ.data.summary.service_codes,
              )
            : "Loading…"}
        </DialogDescription>
      </DialogHeader>

      {bundleQ.isLoading || !bundleQ.data ? (
        <div className="py-12 text-center">
          <Loader2 className="size-5 animate-spin inline" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-0">
          <div className="overflow-y-auto pr-2 space-y-3 border-r min-h-0">
            <SourcePanel bundle={bundleQ.data} />
          </div>

          <div className="overflow-y-auto pl-2 flex flex-col gap-3 min-h-0">
            {bundleQ.data.summary.summary_kind === "financial_statement" ? (
              <PbaPanel
                status={bundleQ.data.summary.status}
                onMarkComplete={() => {
                  setContent(
                    "Monthly financial statement generated and sent to Support Coordinator.",
                  );
                  setAiAttested(true);
                  setShowFinalize(true);
                }}
              />
            ) : bundleQ.data.summary.status === "no_source" ? (
              <NoSourceBanner />
            ) : draftMut.isPending ? (
              <div className="rounded border bg-blue-50 px-3 py-2 text-sm text-blue-800 flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Nectar is drafting from code-tagged
                notes…
              </div>
            ) : null}

            {bundleQ.data.summary.summary_kind === "narrative" && (
              <>
                {bundleQ.data.summary.include_goal_progress && bundleQ.data.goals.length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        General summary
                      </Label>
                      <Textarea
                        value={generalDraft}
                        onChange={(e) => setGeneralDraft(e.target.value)}
                        className="mt-1 min-h-[100px] text-sm"
                        disabled={locked}
                        placeholder="Overall status and services this period…"
                      />
                    </div>
                    {bundleQ.data.goals.map((g) => (
                      <div key={g.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium leading-snug">{g.goal}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {g.job_codes.length
                                ? `Codes: ${g.job_codes.join(", ")}`
                                : "No job codes tagged — Nectar uses period services"}
                            </div>
                          </div>
                          {!locked && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={draftMut.isPending}
                              onClick={() => draftMut.mutate(g.id)}
                            >
                              <Sparkles className="size-3.5 mr-1" /> Draft
                            </Button>
                          )}
                        </div>
                        <Textarea
                          value={goalDrafts[g.id] ?? ""}
                          onChange={(e) =>
                            setGoalDrafts((prev) => ({ ...prev, [g.id]: e.target.value }))
                          }
                          className="min-h-[88px] text-sm"
                          disabled={locked}
                          placeholder="Progress on this goal…"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Draft will appear here once Nectar finishes…"
                    className="min-h-[420px] font-mono text-sm"
                    disabled={locked}
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => draftMut.mutate(undefined)}
                    disabled={draftMut.isPending || locked}
                  >
                    <Sparkles className="size-4 mr-1" />
                    {bundleQ.data.summary.status === "no_source"
                      ? "Try Nectar again"
                      : "Re-draft all with Nectar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveMut.mutate()}
                    disabled={saveMut.isPending || locked}
                  >
                    <Save className="size-4 mr-1" /> Save draft
                  </Button>
                  {!locked && (
                    <Button size="sm" onClick={() => setShowFinalize(true)}>
                      <CheckCircle2 className="size-4 mr-1" /> Finalize
                    </Button>
                  )}
                  {locked && (
                    <Button size="sm" onClick={() => void handleDownload()}>
                      <Download className="size-4 mr-1" /> Download PDF
                    </Button>
                  )}
                  {locked && filing === "upi" && !bundleQ.data.summary.upi_entered_at && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => upiMut.mutate()}
                      disabled={upiMut.isPending}
                    >
                      Mark entered in UPI
                    </Button>
                  )}
                  {locked &&
                    filing === "support_coordinator" &&
                    !bundleQ.data.summary.sc_sent_at && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => scMut.mutate()}
                        disabled={scMut.isPending}
                      >
                        Mark sent to Support Coordinator
                      </Button>
                    )}
                </div>
              </>
            )}

            <EmploymentAttestation organizationId={organizationId} summary={bundleQ.data.summary} />
          </div>
        </div>
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
