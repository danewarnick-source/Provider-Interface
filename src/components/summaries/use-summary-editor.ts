// State and actions behind the progress summary editor (summary-editor.tsx):
// load the summary with its evidence, keep the editor's fields (autosaved,
// debounced and on blur / close), Nectar (draft from the records, or review
// what was typed: suggestions to Accept / Keep mine, findings to fix or keep
// as is), finalize once nothing is open (then download the PDF), and the
// UPI / support coordinator attestations.

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
import { runSummaryNectar, updateSummaryReview } from "@/lib/progress-summary-draft.functions";
import {
  acceptSuggestion,
  emptyReviewState,
  liveNectarFindings,
  openFindings,
  summaryChecks,
  type FieldKey,
  type SummaryReviewState,
} from "@/lib/progress-summary-review";
import {
  buildSummaryDoc,
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
  const reviewFn = useServerFn(updateSummaryReview);
  const saveFn = useServerFn(saveSummaryDraft);
  const finalizeFn = useServerFn(finalizeSummary);
  const upiFn = useServerFn(attestSummaryUpiEntered);
  const scFn = useServerFn(attestSummarySentToSc);
  const reopenFn = useServerFn(reopenSummary);

  const bundleQ = useQuery({
    queryKey: ["summary", summaryId],
    queryFn: () => getBundleFn({ data: { organizationId, summaryId } }),
  });
  const b = bundleQ.data;

  const [editor, setEditor] = useState<SummaryEditorState | null>(null);
  const [review, setReview] = useState<SummaryReviewState>(emptyReviewState());
  const [finalizerName, setFinalizerName] = useState("");
  const [aiAttested, setAiAttested] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // The editor's fields load once; refetches (after a draft, finalize or an
  // attestation) never replace what is on screen.
  const lastSaved = useRef<string>("");
  useEffect(() => {
    if (!b || editor) return;
    setEditor(b.editor);
    setReview(b.review);
    lastSaved.current = JSON.stringify(b.editor);
    setAiAttested(!!b.summary.ai_review_attested_at);
  }, [b, editor]);

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

  // Save whatever is pending when the editor closes.
  useEffect(
    () => () => {
      void flush().then(() => qc.invalidateQueries({ queryKey: ["summaries"] }));
    },
    [flush, qc],
  );

  // ─── Nectar ──────────────────────────────────────────────────────────────
  const hasRecords = (b?.evidence.length ?? 0) > 0;
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
      const n = res.review.suggestions.length;
      const f = res.review.findings.length;
      toast.success(
        n || f
          ? `Nectar: ${n} suggestion${n === 1 ? "" : "s"}, ${f} item${f === 1 ? "" : "s"} to check.`
          : "Nectar found nothing to change.",
      );
      if (res.rejected) {
        toast.info(
          `Nectar's rewrite of ${res.rejected} field${res.rejected === 1 ? "" : "s"} was dropped: it had dates or numbers not in your text or the records.`,
        );
      }
      void bundleQ.refetch();
      qc.invalidateQueries({ queryKey: ["summaries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewOp = useMutation({
    mutationFn: (
      op:
        | { op: "accept" | "keep"; field: FieldKey }
        | { op: "dismiss"; key: string; reason: string | null },
    ) =>
      reviewFn({ data: { organizationId, summaryId, op } }),
    onSuccess: (res) => setReview(res.review),
    onError: (e: Error) => toast.error(e.message),
  });

  const accept = (field: FieldKey) => {
    if (!editor) return;
    try {
      const res = acceptSuggestion(editor, review, field);
      setEditor(res.editor);
      setReview(res.review);
      reviewOp.mutate({ op: "accept", field });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const keep = (field: FieldKey) => reviewOp.mutate({ op: "keep", field });
  const dismiss = (key: string, reason: string | null) =>
    reviewOp.mutate({ op: "dismiss", key, reason });

  const checks = useMemo(
    () =>
      b && editor
        ? summaryChecks(
            {
              periodStart: b.summary.period_start,
              periodEnd: b.summary.period_end,
              serviceCodes: b.summary.service_codes,
              summaryKind: b.summary.summary_kind,
              includeGoalProgress: b.summary.include_goal_progress,
              goals: b.goals,
            },
            editor,
          )
        : [],
    [b, editor],
  );
  const open = useMemo(
    () => (editor ? openFindings(checks, review, editor) : []),
    [checks, review, editor],
  );
  /** Everything to show next to the fields: open, kept as is, and Nectar's notes on pending rewrites. */
  const shown = useMemo(
    () =>
      editor
        ? [
            ...checks,
            ...liveNectarFindings(review, editor),
            ...review.findings.filter((f) => f.onSuggestion),
          ]
        : [],
    [checks, review, editor],
  );

  const autoDrafted = useRef(false);
  useEffect(() => {
    if (!b || !editor || autoDrafted.current) return;
    autoDrafted.current = true;
    if (b.summary.summary_kind === "narrative" && b.summary.status === "pending" && hasRecords) {
      nectarMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, editor]);

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
    bundleQ,
    checks,
    dismiss,
    doc,
    editor,
    hasRecords,
    keep,
    nectarMut,
    open,
    reopenMut,
    review,
    shown,
    reviewOp,
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
  };
}
