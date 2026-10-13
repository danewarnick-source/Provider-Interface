// Knowledge base uploads (N3). The browser asks for a signed upload URL, sends
// the file straight to the nectar-documents bucket (no base64 through a
// server function), then names the returned path when it saves the draft or
// the new version (library.functions.ts), which reads the file's text.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireLibraryAdmin } from "./access.server";
import { UploadUrlInput } from "./library-input";
import { LIBRARY_BUCKET, libraryObjectPath, uploadProblem } from "./uploads";

/** A one-time signed upload URL for a library file under "<org>/library/". */
export const createLibraryUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadUrlInput.parse(input))
  .handler(async ({ data, context }) => {
    const { db, orgId } = await requireLibraryAdmin(context, data.organizationId, "edit");
    const problem = uploadProblem(data);
    if (problem) throw new Error(problem);
    const path = libraryObjectPath(orgId, data.fileName, crypto.randomUUID());
    const { data: signed, error } = await db.storage
      .from(LIBRARY_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Could not start the upload. Try again.");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });
