// State and actions behind the progress summary editor (summary-editor.tsx):
// load the summary with its source, auto-draft with Nectar, save, finalize
// (then download the PDF), and the UPI / support coordinator attestations.

import { useEffect, useState } from "react";
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
import { summaryText } from "@/lib/progress-summary-text";
import { downloadSummaryPdf } from "./download-summary";
import { summaryFilingDestination } from "@/lib/progress-summaries";

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

  const [content, setContent] = useState("");
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({});
  const [generalDraft, setGeneralDraft] = useState("");
  const [finalizerName, setFinalizerName] = useState("");
  const [aiAttested, setAiAttested] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [autoDrafted, setAutoDrafted] = useState(false);

  useEffect(() => {
    if (!bundleQ.data) return;
    const s = bundleQ.data.summary;
    const raw = s.final_content ?? s.draft_content ?? "";
    setContent(raw);
    setAiAttested(!!s.ai_review_attested_at);
    // Parse goal sections from existing prose when possible.
    const parsed: Record<string, string> = {};
    for (const g of bundleQ.data.goals) {
      const re = new RegExp(
        `Goal:\\s*${g.goal.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\nGoal:|\\n[A-Z][A-Z ]{2,}:|$)`,
        "i",
      );
      const m = raw.match(re);
      parsed[g.id] = m?.[1]?.trim() ?? "";
    }
    setGoalDrafts(parsed);
    const gen = raw.match(
      /GENERAL SUMMARY\s*\n([\s\S]*?)(?=\nGOAL PROGRESS|\n[A-Z][A-Z ]{2,}:|$)/i,
    );
    setGeneralDraft(gen?.[1]?.trim() ?? "");
    if (!finalizerName) {
      (async () => {
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .maybeSingle();
        const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
        setFinalizerName(name || user.email || "");
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleQ.data]);

  const assembleContent = (
    general: string,
    goalsMap: Record<string, string>,
    goals: SummarySourceBundle["goals"],
  ) => {
    const b = bundleQ.data;
    if (!b || !b.summary.include_goal_progress || goals.length === 0) return content;
    return summaryText({
      clientName,
      provider: b.organization.legal_name || b.organization.name || orgName || "Provider",
      supportCoordinator: b.client.support_coordinator?.name || "Not on file",
      summary: b.summary,
      general,
      goalDrafts: goalsMap,
      goals,
    });
  };

  const draftMut = useMutation({
    mutationFn: (goalId?: string) =>
      draftFn({ data: { organizationId, summaryId, ...(goalId ? { goalId } : {}) } }),
    onSuccess: () => {
      bundleQ.refetch();
      qc.invalidateQueries({ queryKey: ["summaries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!bundleQ.data || autoDrafted) return;
    const s = bundleQ.data.summary;
    if (s.summary_kind === "narrative" && s.status === "pending") {
      setAutoDrafted(true);
      draftMut.mutate(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleQ.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const goals = bundleQ.data?.goals ?? [];
      const assembled =
        goals.length > 0 && bundleQ.data?.summary.include_goal_progress
          ? assembleContent(generalDraft, goalDrafts, goals)
          : content;
      setContent(assembled);
      return saveFn({ data: { organizationId, summaryId, content: assembled } });
    },
    onSuccess: () => {
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["summaries"] });
      bundleQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalizeMut = useMutation({
    mutationFn: async () => {
      const goals = bundleQ.data?.goals ?? [];
      const assembled =
        goals.length > 0 && bundleQ.data?.summary.include_goal_progress
          ? assembleContent(generalDraft, goalDrafts, goals)
          : content;
      setContent(assembled);
      return finalizeFn({
        data: {
          organizationId,
          summaryId,
          content: assembled,
          finalizedByName: finalizerName.trim(),
          aiReviewAttested: aiAttested,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Summary finalized — download PDF, then attest filing.");
      qc.invalidateQueries({ queryKey: ["summaries"] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
      await bundleQ.refetch();
      setShowFinalize(false);
      // Packet download after finalize (user can re-download anytime).
      setTimeout(() => {
        void handleDownload();
      }, 100);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upiMut = useMutation({
    mutationFn: () => upiFn({ data: { organizationId, summaryId } }),
    onSuccess: () => {
      toast.success("UPI entry attested. Deadline cleared.");
      qc.invalidateQueries({ queryKey: ["summaries"] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
      bundleQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scMut = useMutation({
    mutationFn: () => scFn({ data: { organizationId, summaryId } }),
    onSuccess: () => {
      toast.success("Sent to Support Coordinator attested. Deadline cleared.");
      qc.invalidateQueries({ queryKey: ["summaries"] });
      qc.invalidateQueries({ queryKey: ["deadlines"] });
      bundleQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDownload = async () => {
    if (!bundleQ.data) return;
    await downloadSummaryPdf({
      b: bundleQ.data,
      content,
      finalizerName,
      aiAttested,
      clientName,
      orgName,
    });
  };

  const locked = bundleQ.data?.summary.status === "finalized";
  const filing = bundleQ.data
    ? summaryFilingDestination(
        bundleQ.data.summary.summary_kind,
        bundleQ.data.summary.service_codes,
      )
    : "none";

  return {
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
  };
}
