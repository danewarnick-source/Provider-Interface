// Upload a picked PCSP PDF straight to storage (client-documents) so the
// server reads it from there: a large PDF never travels in a server
// function's request body, which hosts cap at a few MB.

import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 15 * 1024 * 1024;

/** Upload into `folder` ("<org>/<client>/pcsp/" or "<org>/new-clients/"); returns the storage path. */
export async function uploadPcspFile(folder: string, file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("This PDF is over 15 MB. Upload a smaller copy.");
  if (file.type && file.type !== "application/pdf")
    throw new Error("Upload the PCSP as a PDF printed from USTEPS.");
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${folder}${Date.now()}_${safe}`;
  const up = await supabase.storage
    .from("client-documents")
    .upload(path, file, { contentType: "application/pdf", upsert: false });
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
  return path;
}
