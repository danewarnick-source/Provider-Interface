// Support strategies (client_specific_trainings, training_type
// 'support_strategies'): one strategy per PCSP support paid to the agency,
// grouped under its goal and open by default. Nectar drafts; a person edits
// each one in place and approves. Sections someone edited survive a rebuild.
// Admins manage them; due to the support coordinator 30 days after the PCSP
// is activated.

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { strategiesDueOn } from "@/lib/clients/plan-dates";
import type { ClientPlan } from "@/lib/clients/plans";
import {
  isUploadDoc,
  strategyCoverage,
  strategyStatus,
  strategyView,
  withStrategy,
  type StrategySupport,
} from "@/lib/clients/support-strategies";
import {
  attachSupportStrategyDocument,
  draftSupportStrategies,
  getSupportStrategiesTraining,
  publishClientSpecificTraining,
  updateClientSpecificTraining,
  type CSTContent,
} from "@/lib/clients/training.functions";
import { PcspFirstDialog } from "./support-strategies-parts";
import { StrategiesEmpty, StrategiesStatus, StrategiesUploaded } from "./support-strategies-cards";
import { SupportStrategiesList } from "./support-strategies-list";
import { PublishConfirmDialog } from "./publish-confirm-dialog";

type SSRow = {
  id: string;
  content: CSTContent;
  status: string;
  version: number;
  approved_at: string | null;
};

export function SupportStrategiesPanel({
  clientId,
  orgId,
  plan,
  supports,
  canEdit,
}: {
  clientId: string;
  orgId?: string;
  /** The current plan year (due date; "out of date" when newer than the approval). */
  plan: ClientPlan | null;
  /** The current plan's supports paid to the agency. */
  supports: StrategySupport[];
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const getSS = useServerFn(getSupportStrategiesTraining);
  const draftSS = useServerFn(draftSupportStrategies);
  const attachSS = useServerFn(attachSupportStrategyDocument);
  const updateFn = useServerFn(updateClientSpecificTraining);
  const publishFn = useServerFn(publishClientSpecificTraining);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pcspPrompt, setPcspPrompt] = useState(false);
  const [publishDialog, setPublishDialog] = useState(false);
  const queryKey = ["support-strategies-training", clientId];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: canEdit,
    queryFn: () => getSS({ data: { clientId } }),
  });
  const training = (data?.training ?? null) as SSRow | null;
  const refresh = () => qc.invalidateQueries({ queryKey });
  const fail = (e: Error) => toast.error(e.message);

  const draftMut = useMutation({
    mutationFn: (mode: "nectar" | "blank" | "rebuild") => draftSS({ data: { clientId, mode } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Support strategies drafted. Review each one below, then approve.");
      requestAnimationFrame(() =>
        listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    },
    onError: fail,
  });
  const updateMut = useMutation({
    mutationFn: (content: CSTContent) => updateFn({ data: { id: training!.id, content } }),
    onSuccess: () => {
      refresh();
      toast.success("Strategy saved.");
    },
    onError: fail,
  });
  const publishMut = useMutation({
    mutationFn: (note?: string) => publishFn({ data: { id: training!.id, note } }),
    onSuccess: () => refresh(),
    onError: fail,
  });

  const pcspReady = !!plan;
  /** Runs `fn` when a PCSP is on file; otherwise explains why not. */
  const needPcsp = (fn: () => void) => () => (pcspReady ? fn() : setPcspPrompt(true));

  async function handleFileUpload(file: File) {
    if (!orgId) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${orgId}/${clientId}/support-strategy/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("client-documents")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      await attachSS({ data: { clientId, fileName: file.name, storagePath: path } });
      refresh();
      toast.success("Document attached.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      className="hidden"
      accept=".pdf,.docx,.txt,.doc"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void handleFileUpload(file);
        e.target.value = "";
      }}
    />
  );
  const pickFile = needPcsp(() => fileInputRef.current?.click());

  const content = training?.content;
  const uploaded = !!content && isUploadDoc(content);
  const link = uploaded ? content!.sections[0].items[0] : null;
  const fileName = link?.kind === "link" ? (link.links[0]?.label ?? "document") : "document";
  const sections = !content || uploaded ? [] : content.sections;
  const coverage = strategyCoverage(supports, sections);
  const status = training
    ? strategyStatus(training, data?.approverName ?? null, plan, supports, sections)
    : null;
  const rebuild = needPcsp(() => {
    if (
      window.confirm(
        "Rebuild from PCSP supports? Strategies someone edited are kept; the rest are drafted again.",
      )
    )
      draftMut.mutate("rebuild");
  });

  return (
    <SectionCard
      icon={ClipboardList}
      tone="ok"
      title="Support strategies"
      description="Support strategies: instructions to staff for each support."
      testId="support-strategies-card"
    >
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          Admins write and approve this client's support strategies.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !training ? (
        <StrategiesEmpty
          pcspReady={pcspReady}
          supportCount={supports.length}
          drafting={draftMut.isPending}
          uploading={uploading || !orgId}
          onDraft={(mode) => needPcsp(() => draftMut.mutate(mode))()}
          onUpload={pickFile}
          fileInput={fileInput}
        />
      ) : uploaded ? (
        <StrategiesUploaded
          fileName={fileName}
          published={training.status === "published"}
          publishing={publishMut.isPending}
          uploading={uploading || !orgId}
          onPublish={needPcsp(() => setPublishDialog(true))}
          onReplace={pickFile}
          fileInput={fileInput}
        />
      ) : (
        <div className="space-y-3" ref={listRef}>
          <StrategiesStatus
            status={status!}
            covered={coverage.covered}
            total={coverage.total}
            dueOn={strategiesDueOn(plan)}
            canEdit={canEdit}
            busy={{ approving: publishMut.isPending, rebuilding: draftMut.isPending }}
            onApprove={needPcsp(() => setPublishDialog(true))}
            onRebuild={rebuild}
          />
          <SupportStrategiesList
            views={sections.map(strategyView)}
            currentIds={new Set(supports.map((s) => s.supportId))}
            canEdit={canEdit}
            saving={updateMut.isPending}
            onSave={(id, text) => updateMut.mutateAsync(withStrategy(content!, id, text))}
          />
        </div>
      )}
      <PcspFirstDialog open={pcspPrompt} onOpenChange={setPcspPrompt} />
      {training ? (
        <PublishConfirmDialog
          open={publishDialog}
          onOpenChange={setPublishDialog}
          clientId={clientId}
          orgId={orgId}
          kindLabel="support strategies"
          isPublishing={publishMut.isPending}
          publishAsync={(note) => publishMut.mutateAsync(note)}
          gaps={
            uploaded
              ? undefined
              : coverage.missing.map((s) => `${s.support || "Support"} (${s.codes.join(", ")})`)
          }
        />
      ) : null}
    </SectionCard>
  );
}
