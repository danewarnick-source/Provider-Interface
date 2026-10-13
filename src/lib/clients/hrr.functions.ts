// Rights restriction (HRR) server functions: attach the HRR's own document,
// let Nectar draft the answers from it (saves nothing), and save the HRR.
// Every one needs HRC: Edit for this client (assertCanManageClient); a save
// that signs also needs Clients: Edit. Who signed and when is stamped by the
// database trigger (hrr_stamp_signatures), never taken from the caller. Editing
// the answers after signing clears the signatures.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient, type ManageClientAction } from "./guards.server";
import { askNectarJson } from "./client-doc-texts.server";
import { assertRowsChanged } from "./writes";
import {
  HRR_NECTAR_SYSTEM,
  checkHrrDraft,
  cleanHrrPatch,
  hrrNectarPrompt,
  hrrPatchSigns,
  hrrSaveError,
  withSignaturesCleared,
  type HrrDraft,
  type HrrSignerKey,
  type RestrictionRecord,
} from "./hrc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

const scope = z.object({
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  restrictionId: z.string().uuid(),
});
type Scope = z.infer<typeof scope>;

async function guard(
  context: { supabase?: unknown; userId?: string | null },
  s: Scope,
  actions: ManageClientAction[],
) {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  const sb = context.supabase as Sb;
  for (const action of actions) {
    await assertCanManageClient({
      supabase: sb,
      actorId: context.userId,
      organizationId: s.organizationId,
      clientId: s.clientId,
      action,
    });
  }
  return { sb, userId: context.userId };
}

async function loadRestriction(sb: Sb, s: Scope): Promise<RestrictionRecord> {
  const { data, error } = await sb
    .from("hrc_restriction_records")
    .select("*")
    .eq("id", s.restrictionId)
    .eq("organization_id", s.organizationId)
    .eq("client_id", s.clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Rights restriction not found.");
  return data as unknown as RestrictionRecord;
}

/** Records the uploaded file in the client's documents and links it to this HRR. */
export const attachHrrDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope
      .extend({
        fileName: z.string().min(1).max(300),
        storagePath: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ documentId: string }> => {
    const { sb, userId } = await guard(context, data, ["edit_hrc"]);
    if (!data.storagePath.startsWith(`${data.clientId}/`))
      throw new Error("That file isn't in this client's documents.");
    await loadRestriction(sb, data);
    const { data: doc, error } = await sb
      .from("client_documents")
      .insert({
        organization_id: data.organizationId,
        client_id: data.clientId,
        document_type: "hrc_approval",
        file_name: data.fileName,
        file_url: data.storagePath,
        storage_path: data.storagePath,
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { data: rows, error: uErr } = await sb
      .from("hrc_restriction_records")
      .update({ document_id: doc.id })
      .eq("id", data.restrictionId)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .select("id");
    if (uErr) throw new Error(uErr.message);
    assertRowsChanged(rows);
    return { documentId: doc.id as string };
  });

export type HrrDraftResult = ({ readable: true } & HrrDraft) | { readable: false };

/** Nectar reads this HRR's document and drafts answers. Only checked answers come back; nothing is saved. */
export const draftHrrFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scope.parse(d))
  .handler(async ({ data, context }): Promise<HrrDraftResult> => {
    const { sb } = await guard(context, data, ["edit_hrc"]);
    const r = await loadRestriction(sb, data);
    if (!r.document_id) throw new Error("Upload the HRR document first.");
    const { data: doc, error } = await sb
      .from("client_documents")
      .select("file_name, storage_path")
      .eq("id", r.document_id)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc?.storage_path) throw new Error("The uploaded file wasn't found.");
    const dl = await sb.storage.from("client-documents").download(doc.storage_path as string);
    if (dl.error || !dl.data)
      throw new Error(dl.error?.message ?? "The uploaded file wasn't found.");
    const { extractTextFromUpload } = await import("@/lib/document-text.server");
    const blob = dl.data as Blob;
    const text = await extractTextFromUpload(
      Buffer.from(await blob.arrayBuffer()),
      (doc.file_name as string | null) ?? "",
      blob.type,
    );
    if (text.trim().length < 20) return { readable: false };
    const reply = await askNectarJson(
      data.organizationId,
      HRR_NECTAR_SYSTEM,
      hrrNectarPrompt(r.restriction_title, text),
      "Nectar couldn't read the document. Try again, or fill the answers by hand.",
    );
    return { readable: true, ...checkHrrDraft(reply, text) };
  });

/**
 * Saves changed HRR columns. Signing needs Clients: Edit too, and every
 * question answered. Changing the title or an answer clears the signatures
 * already given (withSignaturesCleared), so everyone signs again.
 */
export const saveHrr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    scope.extend({ patch: z.record(z.string(), z.unknown()) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string; cleared: HrrSignerKey[] }> => {
    const cleaned = cleanHrrPatch(data.patch);
    const actions: ManageClientAction[] = hrrPatchSigns(cleaned)
      ? ["edit_hrc", "edit"]
      : ["edit_hrc"];
    const { sb } = await guard(context, data, actions);
    if (!Object.keys(cleaned).length) return { id: data.restrictionId, cleared: [] };
    const before = await loadRestriction(sb, data);
    const problem = hrrSaveError(before, cleaned);
    if (problem) throw new Error(problem);
    const { patch, cleared } = withSignaturesCleared(before, cleaned);
    const { data: rows, error } = await sb
      .from("hrc_restriction_records")
      .update(patch)
      .eq("id", data.restrictionId)
      .eq("organization_id", data.organizationId)
      .eq("client_id", data.clientId)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: data.restrictionId, cleared };
  });
