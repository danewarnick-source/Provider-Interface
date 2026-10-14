import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LIBRARY_BUCKET, uploadProblem } from "@/lib/nectar/library/uploads";
import { createLibraryUploadUrl } from "@/lib/nectar/library/uploads.functions";

/** New document / edit: typed text, or a file to upload. */
export type SourceValue = { mode: "text" | "file"; text: string; file: File | null };

export function sourceReady(value: SourceValue): boolean {
  return value.mode === "text" ? value.text.trim().length > 0 : !!value.file;
}

/** What a Knowledge base file upload accepts: files whose text can be read. */
export const LIBRARY_FILE_ACCEPT =
  ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

/**
 * Sends a file straight to the agency's library folder with a signed upload
 * URL (no file bytes through a server function), then returns what the draft
 * or new version names.
 */
export function useUploadLibraryFile(orgId: string) {
  const urlFn = useServerFn(createLibraryUploadUrl);
  return useCallback(
    async (file: File) => {
      const meta = { fileName: file.name, mimeType: file.type || null, sizeBytes: file.size };
      const problem = uploadProblem(meta);
      if (problem) throw new Error(problem);
      const signed = await urlFn({ data: { organizationId: orgId, ...meta } });
      const { error } = await supabase.storage
        .from(LIBRARY_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: file.type || undefined,
        });
      if (error) throw new Error("Could not upload the file. Try again.");
      return { path: signed.path, ...meta };
    },
    [orgId, urlFn],
  );
}
