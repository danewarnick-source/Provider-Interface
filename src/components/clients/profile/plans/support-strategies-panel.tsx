// Support strategies for this client (client_specific_trainings,
// training_type 'support_strategies'): draft from PCSP goals with Nectar,
// write by hand or upload a document, edit, then a person approves and
// publishes. Drafting and publishing need a PCSP on file.

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import {
  SectionsView,
  PublishConfirmDialog,
} from "@/components/clients/profile/client-specific-training-card";
import {
  attachSupportStrategyDocument,
  draftSupportStrategies,
  getSupportStrategiesTraining,
  publishClientSpecificTraining,
  updateClientSpecificTraining,
  type CSTContent,
} from "@/lib/clients/training.functions";
import {
  PcspFirstDialog,
  SSStatusBadge,
  SupportStrategyCoveragePanel,
  isUploadDoc,
} from "./support-strategies-parts";
import {
  StrategiesDescription,
  StrategiesEmpty,
  StrategiesToolbar,
  StrategiesUploaded,
} from "./support-strategies-cards";
import { useHasPcsp } from "./use-latest-document";

type SSRow = { id: string; content: CSTContent; status: string; version: number };

export function SupportStrategiesPanel({
  clientId,
  orgId,
  dueOn,
}: {
  clientId: string;
  orgId?: string;
  /** Current plan activation + 30 days; shown until published. */
  dueOn: string | null;
}) {
  const qc = useQueryClient();
  const getSS = useServerFn(getSupportStrategiesTraining);
  const draftSS = useServerFn(draftSupportStrategies);
  const attachSS = useServerFn(attachSupportStrategyDocument);
  const updateFn = useServerFn(updateClientSpecificTraining);
  const publishFn = useServerFn(publishClientSpecificTraining);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState<CSTContent | null>(null);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [pcspPrompt, setPcspPrompt] = useState(false);
  const [publishDialog, setPublishDialog] = useState(false);
  const queryKey = useMemo(() => ["support-strategies-training", clientId], [clientId]);

  const pcspReady = useHasPcsp(clientId);
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => getSS({ data: { clientId } }) });
  const training = (data?.training ?? null) as SSRow | null;

  const done = (msg: string) => () => {
    qc.invalidateQueries({ queryKey });
    setEditing(false);
    setDraftContent(null);
    toast.success(msg);
  };
  const draftMut = useMutation({
    mutationFn: (mode: "nectar" | "blank" | "rebuild") => draftSS({ data: { clientId, mode } }),
    onSuccess: done("Support strategies draft ready."),
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (payload: { id: string; content: CSTContent }) => updateFn({ data: payload }),
    onSuccess: done("Saved."),
    onError: (e: Error) => toast.error(e.message),
  });
  const publishMut = useMutation({
    mutationFn: (id: string) => publishFn({ data: { id } }),
    onSuccess: done("Support strategies published."),
    onError: (e: Error) => toast.error(e.message),
  });

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
      qc.invalidateQueries({ queryKey });
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

  const content = training?.content as CSTContent | undefined;
  const uploaded = !!content && isUploadDoc(content);
  const link = uploaded ? content!.sections[0].items[0] : null;
  const fileName = link?.kind === "link" ? (link.links[0]?.label ?? "document") : "document";
  const published = training?.status === "published";
  const working: CSTContent | undefined = editing && draftContent ? draftContent : content;

  return (
    <>
      <SectionCard
        icon={ClipboardList}
        tone="ok"
        title="Support strategies"
        description={
          <StrategiesDescription dueOn={training?.status === "published" ? null : dueOn} />
        }
        actions={
          training ? (
            <>
              <SSStatusBadge status={training.status} version={training.version} />
              {!uploaded && bodyOpen ? (
                <StrategiesToolbar
                  editing={editing}
                  published={published}
                  rebuilding={draftMut.isPending}
                  publishing={publishMut.isPending}
                  saving={updateMut.isPending}
                  onEdit={needPcsp(() => {
                    setDraftContent(structuredClone(content!));
                    setEditing(true);
                  })}
                  onRebuild={needPcsp(() => {
                    if (
                      window.confirm("Rebuild from current PCSP goals? The draft will be replaced.")
                    )
                      draftMut.mutate("rebuild");
                  })}
                  onPublish={needPcsp(() => setPublishDialog(true))}
                  onCancel={() => {
                    setEditing(false);
                    setDraftContent(null);
                  }}
                  onSave={() =>
                    draftContent && updateMut.mutate({ id: training.id, content: draftContent })
                  }
                />
              ) : null}
              {!editing ? (
                <Button variant="outline" onClick={() => setBodyOpen((v) => !v)}>
                  {bodyOpen ? "Hide strategies" : "Show strategies"}
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !training ? (
          <StrategiesEmpty
            pcspReady={pcspReady}
            drafting={draftMut.isPending}
            uploading={uploading || !orgId}
            onDraft={(mode) => needPcsp(() => draftMut.mutate(mode))()}
            onUpload={pickFile}
            fileInput={fileInput}
          />
        ) : bodyOpen ? (
          <div className="space-y-4">
            {uploaded ? (
              <StrategiesUploaded
                fileName={fileName}
                published={published}
                pcspReady={pcspReady}
                publishing={publishMut.isPending}
                uploading={uploading || !orgId}
                onPublish={needPcsp(() => setPublishDialog(true))}
                onReplace={pickFile}
                fileInput={fileInput}
              />
            ) : (
              <>
                {published && (
                  <SupportStrategyCoveragePanel clientId={clientId} sections={content!.sections} />
                )}
                <SectionsView
                  content={working!}
                  editing={editing}
                  onChange={setDraftContent}
                  clientId={clientId}
                  showJobCodes
                />
              </>
            )}
          </div>
        ) : null}
      </SectionCard>
      <PcspFirstDialog open={pcspPrompt} onOpenChange={setPcspPrompt} />
      {training ? (
        <PublishConfirmDialog
          open={publishDialog}
          onOpenChange={setPublishDialog}
          clientId={clientId}
          orgId={orgId}
          kindLabel="support strategies"
          isPublishing={publishMut.isPending}
          publishAsync={() => publishMut.mutateAsync(training.id)}
        />
      ) : null}
    </>
  );
}
