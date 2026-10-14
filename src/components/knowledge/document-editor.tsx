import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishLibraryVersion, saveLibraryDraft } from "@/lib/nectar/library/library.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { DocumentSourceInput } from "./document-source-input";
import { useKnowledgeNav, useRefreshKnowledge } from "./use-knowledge";
import { sourceReady, useUploadLibraryFile, type SourceValue } from "./use-library-upload";

/**
 * Edit draft (saves the draft) or Publish new version (edit the text or
 * upload a new file; the old version is archived and everyone it's for is
 * asked to review again).
 */
export function DocumentEditor({
  orgId,
  doc,
  text,
  onDone,
}: {
  orgId: string;
  doc: { id: string; version: number; library_status: string };
  text: string;
  onDone: () => void;
}) {
  const isDraft = doc.library_status === "draft";
  const nav = useKnowledgeNav();
  const refresh = useRefreshKnowledge(orgId);
  const saveFn = useServerFn(saveLibraryDraft);
  const versionFn = useServerFn(publishLibraryVersion);
  const upload = useUploadLibraryFile(orgId);
  const [source, setSource] = useState<SourceValue>({ mode: "text", text, file: null });
  const save = useMutation({
    mutationFn: async () => {
      const content =
        source.mode === "file" ? { upload: await upload(source.file!) } : { text: source.text };
      const ids = { organizationId: orgId, documentId: doc.id };
      if (isDraft) {
        await saveFn({ data: { ...ids, ...content } });
        return null;
      }
      return versionFn({ data: { ...ids, ...content } });
    },
    onSuccess: async (next) => {
      await refresh();
      onDone();
      if (!next) {
        toast.success("Draft saved.");
        return;
      }
      toast.success(
        `Version ${next.version} published. The people it's for are asked to review it again.`,
      );
      nav.openDocument(next.id);
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not save the document.")),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (sourceReady(source) && !save.isPending) save.mutate();
      }}
      className="space-y-4"
    >
      <DocumentSourceInput
        idPrefix="kb-edit"
        label={isDraft ? "Edit draft" : "New version text"}
        value={source}
        onChange={setSource}
        disabled={save.isPending}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!sourceReady(source) || save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {isDraft ? "Save draft" : `Publish version ${doc.version + 1}`}
        </Button>
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
