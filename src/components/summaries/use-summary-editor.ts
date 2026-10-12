// State and actions behind the progress summary editor (summary-editor.tsx):
// load the summary with its evidence, keep the editor's fields (autosaved,
// debounced and on blur / close; blank incident rows are never saved),
// Nectar as a helper (draft one box or all boxes straight into the boxes,
// each with its own Undo; a draft that fails the fact checks leaves its box
// unchanged with a one-line note; an optional review; reminders hidden with
// an x), finalize (a soft confirm when a goal is blank; nothing blocks), then
// download the PDF, and the UPI / support coordinator attestations.

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
  applyDraft,
  blankGoals,
  dismissKey,
  draftFailureMessage,
  emptyReviewState,
  fieldText,
  pushUndo,
  summaryReminders,
  textFields,
  undoDraft,
  type FieldKey,
  type ReviewContext,
  type SummaryReviewState,
  type UndoStacks,
} from "@/lib/progress-summary-review";
import {
  buildSummaryDoc,
  filledIncidents,
  groupEvidence,
  summaryDocText,
  type SummaryDoc,
  type SummaryEditorState,
} from "@/lib/progress-summary-doc";
import { summaryFilingDestination } from "@/lib/progress-summaries";
import { downloadSummaryPdf } from "./download-summary";

export type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 1200;

/** The editor as saved: incident rows with no date and no text are left out. */
const savable = (ed: SummaryEditorState): SummaryEditorState => ({
  ...ed,
  incidents: filledIncidents(ed.incidents),
});
const savedJson = (ed: SummaryEditorState) => JSON.stringify(savable(ed));

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
  // What each box held before a Nectar draft, for Undo (this session only).
  const [undoStacks, setUndoStacks] = useState<UndoStacks>({});
  // The one-line note under a box whose draft wasn't used.
  const [draftNotes, setDraftNotes] = useState<Partial<Record<FieldKey, string>>>({});
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
    lastSaved.current = savedJson(b.editor);
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
      const json = savedJson(ed);
      if (json === lastSaved.current) return;
      setSaveState("saving");
      try {
        await saveFn({
          data: {
            organizationId,
            summaryId,
            content: summaryDocText(docFor(cur, ed, clientName, orgName)),
            editor: savable(ed) as unknown as Record<string, unknown>,
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
    if (!editor || locked || savedJson(editor) === lastSaved.current) return;
    const t = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [editor, locked, flush]);

  /** The Save button: save now and say so (a failed save already shows its error). */
  const save = useCallback(async () => {
    await flush();
    const ed = latest.current.editor;
    if (ed && savedJson(ed) === lastSaved.current) toast.success("Summary saved");
  }, [flush]);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      const { editor: ed, locked: isLocked } = latest.current;
      if (!ed || isLocked || savedJson(ed) === lastSaved.current) return;
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
  // Evidence a box can be drafted from: the server uses the same goals
  // (none when goal progress is off) to split goal records from general ones.
  const grouped = useMemo(
    () => (b ? groupEvidence(b.summary.include_goal_progress ? b.goals : [], b.evidence) : null),
    [b],
  );
  const recordsFor = (field: FieldKey): boolean => {
    if (!grouped) return false;
    if (field === "general") return grouped.general.length > 0;
    if (field === "incidentNotes") {
      return grouped.incidents.length > 0 || filledIncidents(editor?.incidents ?? []).length > 0;
    }
    return field.startsWith("goal:") && (grouped.byGoal[field.slice(5)]?.length ?? 0) > 0;
  };

  /** Draft one box, or several in one request; each draft goes straight into its box. */
  const draftMut = useMutation({
    mutationFn: (fields: FieldKey[]) => {
      const ed = latest.current.editor;
      if (!ed) throw new Error("Still loading.");
      return draftFn({
        data: {
          organizationId,
          summaryId,
          editor: savable(ed) as unknown as Record<string, unknown>,
          fields,
        },
      });
    },
    onMutate: (fields) =>
      setDraftNotes((n) => {
        const next = { ...n };
        for (const f of fields) delete next[f];
        return next;
      }),
    onSuccess: (res) => {
      setReview(res.review);
      const ed = latest.current.editor;
      if (ed && res.drafts.length) {
        let next = ed;
        const undos: [FieldKey, ReturnType<typeof applyDraft>["undo"]][] = [];
        for (const d of res.drafts) {
          const r = applyDraft(next, d);
          next = r.editor;
          undos.push([d.field, r.undo]);
        }
        setEditor(next);
        setUndoStacks((u) => undos.reduce((acc, [f, entry]) => pushUndo(acc, f, entry), u));
      }
      setDraftNotes((n) => {
        const next = { ...n };
        for (const f of res.failed) next[f.field] = draftFailureMessage(f);
        return next;
      });
      if (res.drafts.length) {
        toast.success(
          res.drafts.length === 1
            ? "Nectar drafted the box. Undo puts back what was there."
            : `Nectar drafted ${res.drafts.length} boxes. Undo on each puts back what was there.`,
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
    mutationFn: (op: { op: "dismiss"; key: string }) =>
      reviewFn({ data: { organizationId, summaryId, op } }),
    onError: (e: Error) => toast.error(e.message),
  });

  /** Undo the last draft on a box: exactly what it held before. The autosave saves it like any edit. */
  const undo = (field: FieldKey) => {
    if (!editor) return;
    const res = undoDraft(editor, undoStacks, field);
    setEditor(res.editor);
    setUndoStacks(res.stacks);
  };
  /** The x on a reminder: hidden for this summary, saved with the review. */
  const hideKey = (key: string) => {
    setReview((r) => dismissKey(r, key));
    reviewOp.mutate({ op: "dismiss", key });
  };

  /** A box can be drafted when it has text or records (a goal's notes, incident reports, general records). */
  const canDraft = (field: FieldKey) =>
    !!editor && (!!fieldText(editor, field).trim() || recordsFor(field));
  const draftBox = (field: FieldKey) => draftMut.mutate([field]);
  /** Draft all boxes: every box with text or records, in one request. */
  const draftAll = () => {
    if (!editor) return;
    const fields = textFields(goalIds).filter(canDraft);
    if (!fields.length) {
      toast.info("Nothing to draft yet: no text and no records.");
      return;
    }
    draftMut.mutate(fields);
  };

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
          editor: savable(editor) as unknown as Record<string, unknown>,
          doc: finalDoc as unknown as Record<string, unknown>,
          finalizedByName: finalizerName.trim(),
          aiReviewAttested: aiAttested,
        },
      });
      lastSaved.current = savedJson(editor);
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
    aiAttested,
    blank,
    bundleQ,
    canDraft,
    doc,
    draftAll,
    draftBox,
    draftMut,
    draftNotes,
    editor,
    hasRecords,
    hideKey,
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
