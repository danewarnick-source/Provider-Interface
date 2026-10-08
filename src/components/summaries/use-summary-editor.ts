// State and actions behind the progress summary editor (summary-editor.tsx):
// load the summary with its evidence, keep the editor's fields (autosaved,
// debounced and on blur / close), draft with Nectar (merged into what was
// typed, never over it), finalize (then download the PDF), and the UPI /
// support coordinator attestations.

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
  saveSummaryDraft,
  type SummarySourceBundle,
} from "@/lib/progress-summaries.functions";
import { draftProgressSummary } from "@/lib/progress-summary-draft.functions";
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
  const draftFn = useServerFn(draftProgressSummary);
  const saveFn = useServerFn(saveSummaryDraft);
  const finalizeFn = useServerFn(finalizeSummary);
  const upiFn = useServerFn(attestSummaryUpiEntered);
  const scFn = useServerFn(attestSummarySentToSc);

  const bundleQ = useQuery({
    queryKey: ["summary", summaryId],
    queryFn: () => getBundleFn({ data: { organizationId, summaryId } }),
  });
  const b = bundleQ.data;

  const [editor, setEditor] = useState<SummaryEditorState | null>(null);
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
  const draftMut = useMutation({
    mutationFn: () => {
      const ed = latest.current.editor;
      if (!ed) throw new Error("Still loading.");
      return draftFn({
        data: { organizationId, summaryId, editor: ed as unknown as Record<string, unknown> },
      });
    },
    onSuccess: (res) => {
      setEditor(res.editor);
      if (res.status === "no_source") {
        toast.info(
          "No approved daily logs, shift notes or incidents this period — your text is unchanged.",
        );
      }
      void bundleQ.refetch();
      qc.invalidateQueries({ queryKey: ["summaries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoDrafted = useRef(false);
  useEffect(() => {
    if (!b || !editor || autoDrafted.current) return;
    autoDrafted.current = true;
    if (b.summary.summary_kind === "narrative" && b.summary.status === "pending") draftMut.mutate();
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

  const filing = b
    ? summaryFilingDestination(b.summary.summary_kind, b.summary.service_codes)
    : "none";

  return {
    aiAttested,
    bundleQ,
    doc,
    draftMut,
    editor,
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
