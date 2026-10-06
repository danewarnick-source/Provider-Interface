// Client file writes: upload a required document (or replace the one on
// file) with its expiry date, and archive one. Nothing is deleted —
// a replaced document is marked outdated and points at its replacement; an
// archived one keeps its row and file (7-year retention). All need
// Clients: Edit for this client (assertCanManageClient).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import { assertRowsChanged } from "./writes";
import { isYmd } from "./authorizations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const MAX_BYTES = 20 * 1024 * 1024;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const scope = { organizationId: z.string().uuid(), clientId: z.string().uuid() };
const expiry = z
  .string()
  .nullable()
  .refine((v) => v === null || isYmd(v), "Pick a real expiry date.");

async function guard(sb: Sb, userId: string, organizationId: string, clientId: string) {
  await assertCanManageClient({
    supabase: sb,
    actorId: userId,
    organizationId,
    clientId,
    action: "edit",
  });
}

export const uploadClientFileDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ...scope,
        documentType: z
          .string()
          .min(1)
          .max(60)
          .regex(/^[a-z0-9_]+$/),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(128).default("application/octet-stream"),
        fileBase64: z.string().min(4).max(28_000_000),
        expiresOn: expiry,
        replacesId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await guard(sb, userId, organizationId, clientId);
    const bytes = Uint8Array.from(Buffer.from(data.fileBase64, "base64"));
    if (bytes.byteLength > MAX_BYTES)
      throw new Error("This file is over 20 MB. Upload a smaller copy.");

    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${organizationId}/${clientId}/file/${Date.now()}_${safe}`;
    const up = await sb.storage
      .from("client-documents")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
    const { data: rows, error } = await sb
      .from("client_documents")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        document_type: data.documentType,
        file_name: data.fileName,
        file_url: `storage://client-documents/${path}`,
        storage_path: path,
        file_size_bytes: bytes.byteLength,
        uploaded_by: userId,
        expires_on: data.expiresOn,
      })
      .select("id");
    if (error) throw new Error(error.message);
    const id = assertRowsChanged(rows as { id: string }[])[0].id;

    if (data.replacesId) {
      const { data: old, error: oldErr } = await sb
        .from("client_documents")
        .update({ status: "outdated", superseded_by: id, superseded_at: new Date().toISOString() })
        .eq("id", data.replacesId)
        .eq("client_id", clientId)
        .eq("organization_id", organizationId)
        .select("id");
      if (oldErr) throw new Error(oldErr.message);
      assertRowsChanged(old as unknown[]);
    }
    return { id };
  });

export const archiveClientFileDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await guard(sb, userId, data.organizationId, data.clientId);
    const { data: rows, error } = await sb
      .from("client_documents")
      .update({ archived_at: new Date().toISOString(), archived_by: userId })
      .eq("id", data.id)
      .eq("client_id", data.clientId)
      .eq("organization_id", data.organizationId)
      .is("archived_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows as unknown[]);
    return { id: data.id };
  });
