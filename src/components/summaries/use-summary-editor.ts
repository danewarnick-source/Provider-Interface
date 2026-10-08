// State and actions behind the progress summary editor (summary-editor.tsx):
// load the summary with its evidence, keep the editor's fields (autosaved,
// debounced and on blur / close), Nectar as a helper (draft one box or all
// boxes into suggestions to Accept or hide, Undo after Accept, an optional
// review, reminders hidden with an x), finalize (a soft confirm when a goal
// is blank; nothing blocks), then download the PDF, and the UPI / support
// coordinator attestations.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  attestSummarySentToSc,
  attestSummaryUpiEntered,
  finalizeSummary,
  getSummaryWithSource,
  reopenSummary,
  saveSummaryDraft,
  type SummarySourceBundle,
} from "@/lib/progress-summaries.functions";
import {
  draftSummaryBoxes,
  runSummaryNectar,
  updateSummaryReview,
} from "@/lib/progress-summary-draft.functions";
import {
  acceptSuggestion,
  blankGoals,
  dismissKey,
  emptyReviewState,
  fieldText,
  pushUndo,
  summaryReminders,
  suggestionKey,
  takeSuggestion,
  textFields,
  undoAccept,
  visibleSuggestion,
  type FieldKey,
  type FieldSuggestion,
  type ReviewContext,
  type SummaryReviewState,
  type UndoStacks,
} from "@/lib/progress-summary-review";
import {
  buildSummaryDoc,
  groupEvidence,
  summaryDocText,
  type SummaryDoc,
  type SummaryEditorState,
} from "@/lib/progress-summary-doc";
import { summaryFilingDestination } from "@/lib/progress-summaries";
import { downloadSummaryPdf } from "./download-summary";

export type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 1200;

const FILING_NOTE = {
  upi: "Filing: enter the narrative in the state UPI portal, then attest in Provider Interface.",
  support_coordinator:
    "Filing: send this PDF to the Support Coordinator through your secure channel, then attest in Provider Interface.",
  none: null,
} as const;

function docFor(
  b: SummarySourceBundle,
  editor: SummaryEditorState,
  clientName: string,
  orgName: string | null,
  finalize?: { name: string; attested: boolean },
): SummaryDoc {
  const s = b.summary;
  return buildSummaryDoc({
    provider: b.organization.legal_name || b.organization.name || orgName,
    clientName,
    coordinator: b.client.support_coordinator?.name ?? null,
    summary: finalize
      ? {
          ...s,
          status: "finalized",
          finalized_at: new Date().toISOString(),
          finalized_by_name: finalize.name,
        }
      : s,
    teamMembers: b.staffNames,
    goals: b.goals,
    evidence: b.evidence,
    editor,
    aiReviewAttested: finalize?.attested ?? !!s.ai_review_attested_at,
    filingNote: FILING_NOTE[summaryFilingDestination(s.summary_kind, s.service_codes)],
  });
}

export function useSummaryEditor({
  summaryId,
  organizationId,
  orgName,
  clientName,
}: {
  summaryId: string;
  organizationId: string;
  orgName: string | null;
  clientName: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const getBundleFn = useServerFn(getSummaryWithSource);
  const nectarFn = useServerFn(runSummaryNectar);
  const draftFn = useServerFn(draftSummaryBoxes);
  const reviewFn = useServerFn(updateSummaryReview);
  const saveFn = useServerFn(saveSummaryDraft);
  const finalizeFn = useServerFn(finalizeSummary);
  const upiFn = useServerFn(attestSummaryUpiEntered);
  const scFn = useServerFn(attestSummarySentToSc);
  const reopenFn = useServerFn(reopenSummary);

  const bundleQ = useQuery({
    queryKey: ["summary", summaryId],
    queryFn: () => getBundleFn({ data: { organizationId, summaryId } }),
    // Always read the saved copy when the editor opens: a cached bundle from
    // an earlier open would show the text from before the last save.
    refetchOnMount: "always",
  });
  const b = bundleQ.data;

  const [editor, setEditor] = useState<SummaryEditorState | null>(null);
  const [review, setReview] = useState<SummaryReviewState>(emptyReviewState());
  // What each box held before an Accept, for Undo (this session only).
  const [undoStacks, setUndoStacks] = useState<UndoStacks>({});
  const [finalizerName, setFinalizerName] = useState("");
  const [aiAttested, setAiAttested] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // The editor's fields load once, from a fetch made after this open (never a
  // cached copy); later refetches (after a draft, finalize or an attestation)
  // never replace what is on screen.
  const lastSaved = useRef<string>("");
  const fresh = bundleQ.isFetchedAfterMount;
  useEffect(() => {
    if (!b || !fresh || editor) return;
    setEditor(b.editor);
    setReview(b.review);
    lastSaved.current = JSON.stringify(b.editor);
    setAiAttested(!!b.summary.ai_review_attested_at);
  }, [b, fresh, editor]);

  useEffect(() => {
    if (finalizerName || !user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();
      const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
      setFinalizerName(name || user.email || "");
    })();
  }, [user, finalizerName]);

  const locked = b?.summary.status === "finalized";
  const doc = useMemo(
    () => (b && editor ? (locked && b.finalDoc) || docFor(b, editor, clientName, orgName) : null),
    [b, editor, locked, clientName, orgName],
  );

  // ─── Autosave ────────────────────────────────────────────────────────────
  const latest = useRef({ b, editor, locked });
  latest.current = { b, editor, locked };
  const chain = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback((): Promise<void> => {
    chain.current = chain.current.then(async () => {
      const { b: cur, editor: ed, locked: isLocked } = latest.current;
      if (!cur || !ed || isLocked) return;
      const json = JSON.stringify(ed);
      if (json === lastSaved.current) return;
      setSaveState("saving");
      try {
        await saveFn({
          data: {
            organizationId,
            summaryId,
            content: summaryDocText(docFor(cur, ed, clientName, orgName)),
            editor: ed as unknown as Record<string, unknown>,
          },
        });
        lastSaved.current = json;
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        toast.error(`Couldn't save: ${(e as Error).message}`);
      }
    });
    return chain.current;
  }, [saveFn, organizationId, summaryId, clientName, orgName]);

  useEffect(() => {
    if (!editor || locked || JSON.stringify(editor) === lastSaved.current) return;
    const t = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [editor, locked, flush]);

  /** The Save button: save now and say so (a failed save already shows its error). */
  const save = useCallback(async () => {
    await flush();
    if (JSON.stringify(latest.current.editor) === lastSaved.current) toast.success("Summary saved");
  }, [flush]);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      const { editor: ed, locked: isLocked } = latest.current;
      if (!ed || isLocked || JSON.stringify(ed) === lastSaved.current) return;
      void flush();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [flush]);

  // Save whatever is pending when the editor closes.
  useEffect(
    () => () => {
      void flush().then(() =>
        Promise.all([
          qc.invalidateQueries({ queryKey: ["summaries"] }),
          qc.invalidateQueries({ queryKey: ["summary", summaryId] }),
        ]),
      );
    },
    [flush, qc, summaryId],
  );

  // ─── Nectar ──────────────────────────────────────────────────────────────
  const hasRecords = (b?.evidence.length ?? 0) > 0;
  const goalIds = useMemo(
    () => (b?.summary.include_goal_progress ? b.goals.map((g) => g.id) : []),
    [b],
  );
  const byGoal = useMemo(() => (b ? groupEvidence(b.goals, b.evidence).byGoal : {}), [b]);
  const evidenceFor = (field: FieldKey) =>
    field.startsWith("goal:") ? (byGoal[field.slice(5)]?.length ?? 0) > 0 : false;

  /** Draft one box, or several in one request. */
  const draftMut = useMutation({
    mutationFn: (fields: FieldKey[]) => {
      const ed = latest.current.editor;
      if (!ed) throw new Error("Still loading.");
      return draftFn({
        data: { organizationId, summaryId, editor: ed as unknown as Record<string, unknown>, fields },
      });
    },
    onSuccess: (res) => {
      setReview(res.review);
      toast.success(
        res.review.suggestions.length
          ? "Nectar has a draft for you to look at."
          : "Nectar found nothing to change.",
      );
      if (res.rejected) {
        toast.info(
          `Nectar's draft for ${res.rejected} box${res.rejected === 1 ? "" : "es"} was dropped: it had dates or numbers that were not in that box.`,
        );
      }
      qc.invalidateQueries({ queryKey: ["summaries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Optional "Review with Nectar": the goal-area yes/no for goals that share nothing with their goal. */
  const nectarMut = useMutation({
    mutationFn: () => {
      const ed = latest.current.editor;
      if (!ed) throw new Error("Still loading.");
      return nectarFn({
        data: { organizationId, summaryId, editor: ed as unknown as Record<string, unknown> },
      });
    },
    onSuccess: (res) => {
      setReview(res.review);
      toast.success(
        res.flagged
          ? "Nectar added a reminder."
          : res.asked
            ? "Nectar found nothing to flag."
            : "Nothing to check. Every goal has matching words.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewOp = useMutation({
    mutationFn: (op: { op: "accept"; field: FieldKey } | { op: "dismiss"; key: string }) =>
      reviewFn({ data: { organizationId, summaryId, op } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const accept = (field: FieldKey) => {
    if (!editor) return;
    const suggestion = visibleSuggestion(review, field);
    if (!suggestion) return;
    try {
      const res = acceptSuggestion(editor, suggestion);
      setEditor(res.editor);
      setUndoStacks((u) => pushUndo(u, field, res.undo));
      setReview((r) => takeSuggestion(r, field));
      reviewOp.mutate({ op: "accept", field });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  /** Undo the last Accept on a box; the autosave saves it like any edit. */
  const undo = (field: FieldKey) => {
    if (!editor) return;
    const res = undoAccept(editor, undoStacks, field);
    setEditor(res.editor);
    setUndoStacks(res.stacks);
  };
  /** The x on a reminder or a suggestion card: hidden for this summary, saved with the review. */
  const hideKey = (key: string) => {
    setReview((r) => dismissKey(r, key));
    reviewOp.mutate({ op: "dismiss", key });
  };
  const hideSuggestion = (s: FieldSuggestion) => hideKey(suggestionKey(s));

  const draftBox = (field: FieldKey) => draftMut.mutate([field]);
  /** Draft all boxes: every box with text, in one request. */
  const draftAll = () => {
    if (!editor) return;
    const fields = textFields(goalIds).filter((f) => fieldText(editor, f).trim());
    if (!fields.length) {
      toast.info("Nothing typed yet to draft.");
      return;
    }
    draftMut.mutate(fields);
  };
  const canDraft = (field: FieldKey) =>
    !!editor && (!!fieldText(editor, field).trim() || evidenceFor(field));

  const reviewCtx = useMemo<ReviewContext | null>(
    () =>
      b
        ? {
            serviceCodes: b.summary.service_codes,
            summaryKind: b.summary.summary_kind,
            includeGoalProgress: b.summary.include_goal_progress,
            goals: b.goals,
            firstName: b.client.first_name,
          }
        : null,
    [b],
  );
  const reminders = useMemo(
    () => (reviewCtx && editor ? summaryReminders(reviewCtx, editor, review) : []),
    [reviewCtx, editor, review],
  );
  /** Goals with no progress text: Finalize asks first, never blocks. */
  const blank = useMemo(
    () => (reviewCtx && editor ? blankGoals(reviewCtx, editor) : []),
    [reviewCtx, editor],
  );

  // ─── Finalize, download, attestations ────────────────────────────────────
  const handleDownload = async (d: SummaryDoc | null = doc) => {
    if (!b || !d) return;
    await downloadSummaryPdf({
      doc: d,
      clientName,
      periodLabel: b.summary.period_label,
      logoPath: b.organization.logo_path,
    });
  };

  const finalizeMut = useMutation({
    mutationFn: async () => {
      if (!b || !editor) throw new Error("Still loading.");
      const finalDoc = docFor(b, editor, clientName, orgName, {
        name: finalizerName.trim(),
        attested: aiAttested,
      });
      await finalizeFn({
        data: {
          organizationId,
          summaryId,
          content: summaryDocText(finalDoc),
          editor: editor as unknown as Record<string, unknown>,
          doc: finalDoc as unknown as Record<string, unknown>,
          finalizedByName: finalizerName.trim(),
          aiReviewAttested: aiAttested,
        },
      });
      lastSaved.current = JSON.stringify(editor);
      return finalDoc;
    },
    onSuccess: async (finalDoc) => {
      toast.success("Summary finalized — download the PDF, then attest filing.");
      qc.invalidateQueries({ queryKey: ["summaries"] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
      await bundleQ.refetch();
      setShowFinalize(false);
      void handleDownload(finalDoc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attestation = (fn: typeof upiFn, done: string) => ({
    mutationFn: () => fn({ data: { organizationId, summaryId } }),
    onSuccess: () => {
      toast.success(done);
      qc.invalidateQueries({ queryKey: ["summaries"] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
      void bundleQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const upiMut = useMutation(attestation(upiFn, "UPI entry attested. Deadline cleared."));
  const scMut = useMutation(
    attestation(scFn, "Sent to Support Coordinator attested. Deadline cleared."),
  );

  const reopenMut = useMutation({
    mutationFn: (reason: string | null) =>
      reopenFn({ data: { organizationId, summaryId, reason } }),
    onSuccess: async () => {
      toast.success("Summary reopened. Finalize again when it's ready.");
      setAiAttested(false);
      qc.invalidateQueries({ queryKey: ["summaries"] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
      await bundleQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filing = b
    ? summaryFilingDestination(b.summary.summary_kind, b.summary.service_codes)
    : "none";

  return {
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
    save,
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
  };
}
