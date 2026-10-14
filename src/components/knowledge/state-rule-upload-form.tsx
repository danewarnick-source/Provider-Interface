import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { stateRuleFileProblem } from "@/lib/nectar/library/state-rules";
import {
  createStateRuleUploadUrl,
  publishStateRuleVersion,
} from "@/lib/nectar/library/state-rules.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { LIBRARY_FILE_ACCEPT } from "./use-library-upload";

/**
 * Add a state rule, or replace one with a new version. The file goes straight
 * to the private state-rules bucket (signed upload URL); publishing reads its
 * text and archives the version it replaces.
 */
export function StateRuleUploadForm({
  rule,
  onPublished,
  onCancel,
}: {
  rule: { ruleKey: string; title: string; effectiveFrom: string | null } | null;
  onPublished: (published: { id: string; version: number }) => void;
  onCancel: () => void;
}) {
  const urlFn = useServerFn(createStateRuleUploadUrl);
  const publishFn = useServerFn(publishStateRuleVersion);
  const [title, setTitle] = useState(rule?.title ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(rule?.effectiveFrom ?? "");
  const [file, setFile] = useState<File | null>(null);
  const publish = useMutation({
    mutationFn: async () => {
      const meta = { fileName: file!.name, mimeType: file!.type || null, sizeBytes: file!.size };
      const problem = stateRuleFileProblem(meta);
      if (problem) throw new Error(problem);
      const signed = await urlFn({ data: meta });
      const sent = await supabase.storage
        .from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, file!, {
          contentType: file!.type || undefined,
        });
      if (sent.error) throw new Error("Could not upload the file. Try again.");
      return publishFn({
        data: {
          ruleKey: rule?.ruleKey,
          title: title.trim() || undefined,
          effectiveFrom: effectiveFrom || null,
          upload: { path: signed.path, ...meta },
        },
      });
    },
    onSuccess: (published) => onPublished(published),
    onError: (e) => toast.error(safeErrorMessage(e, "Could not publish the state rule.")),
  });
  const ready = !!file && title.trim().length > 0 && !publish.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) publish.mutate();
      }}
      className="space-y-3 rounded-lg border border-border bg-background p-4"
    >
      <p className="text-sm font-semibold">
        {rule ? `New version of ${rule.title}` : "Add a state rule"}
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor="sr-title">Name</Label>
          <Input
            id="sr-title"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sr-effective">Effective from (optional)</Label>
          <Input
            id="sr-effective"
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sr-file">File</Label>
        <Input
          id="sr-file"
          type="file"
          accept={LIBRARY_FILE_ACCEPT}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          PDF, Word (.docx) or text, up to 25 MB, with selectable text.
          {rule ? " The current version is archived, not deleted." : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!ready}>
          {publish.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {rule ? "Publish new version" : "Publish"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={publish.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
