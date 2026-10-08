// Support strategies sent to the support coordinator (client_strategy_sends,
// one live record per PCSP plan). The strategies card reads the state
// (strategy-sends.ts) and records or undoes a send. Recording files a copy
// as an accepted "Support Strategies" Evidence file: the exact PDF of the
// approved strategies, or the uploaded strategies document. Undo is a soft
// void; the Evidence file stays on record. Editors only.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { denverYmd } from "@/lib/denver-date";
import { saveUploadOnItem } from "@/lib/evidence/record-upload.server";
import { ITEM_SELECT_WITH_DUE, normalizeItem } from "@/lib/evidence/store.server";
import type { EvidenceItemRow } from "@/lib/evidence/types";
import { applyClientPackPlan, loadClientFileView } from "./file-packs.server";
import { assertCanManageClient } from "./guards.server";
import { currentPlan, type ClientPlan } from "./plans";
import { coordinatorName, loadStrategiesDocument } from "./strategies-doc.server";
import { strategiesApprovedFor, type StrategySendState } from "./strategy-sends";
import { STRATEGIES_KEY, loadStrategyStates } from "./strategy-sends.server";
import { isUploadDoc } from "./support-strategies";
import type { CSTContent } from "./training.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const EVIDENCE_BUCKET = "evidence-files";

type ClientRow = {
  id: string;
  organization_id: string;
  first_name: string | null;
  last_name: string | null;
};

/** The client, after checking the caller may edit it. */
export async function editableClient(sb: AnySupabase, userId: string, clientId: string) {
  const { data, error } = await sb
    .from("clients")
    .select("id, organization_id, first_name, last_name")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Client not found.");
  const client = data as ClientRow;
  await assertCanManageClient({
    supabase: sb,
    actorId: userId,
    organizationId: client.organization_id,
    clientId: client.id,
    action: "edit",
  });
  return client;
}

export type StrategySendStatus = {
  state: StrategySendState;
  /** The current plan (the send is recorded on it). */
  planId: string | null;
  /** Today's support coordinator, shown in the dialog and saved with the send. */
  coordinator: string | null;
};

export const getStrategySendStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<StrategySendStatus> => {
    const sb = context.supabase as AnySupabase;
    const client = await editableClient(sb, context.userId as string, data.clientId);
    const { data: plans } = await sb
      .from("client_plans")
      .select("id, client_id, start_date, end_date, activated_on, status, created_at")
      .eq("client_id", client.id);
    const [states, coordinator] = await Promise.all([
      loadStrategyStates(sb, client.organization_id, [client.id]),
      coordinatorName(sb, client.id),
    ]);
    return {
      state: states.get(client.id) ?? { kind: "not_needed" },
      planId: currentPlan((plans ?? []) as ClientPlan[])?.id ?? null,
      coordinator,
    };
  });

/** The client's "Support Strategies" Evidence item (added with its packs), or null. */
async function strategiesItem(sb: AnySupabase, userId: string, client: ClientRow) {
  const view = await loadClientFileView(sb, client.organization_id, client.id);
  if (view.pending) await applyClientPackPlan(sb, userId, client.organization_id, client.id, view);
  const { data, error } = await sb
    .from("evidence_items")
    .select(ITEM_SELECT_WITH_DUE)
    .eq("organization_id", client.organization_id)
    .eq("subject_type", "client")
    .eq("subject_id", client.id)
    .eq("requirement_key", STRATEGIES_KEY)
    .is("opted_out_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeItem(data as EvidenceItemRow) : null;
}

/** The uploaded strategies document (client_documents) behind an uploaded or copied set. */
export async function uploadedStrategiesDoc(
  sb: AnySupabase,
  clientId: string,
  content: CSTContent | null,
): Promise<{ id: string; file_name: string; storage_path: string } | null> {
  const link = content?.sections[0]?.items[0];
  const name = link?.kind === "link" ? link.links[0]?.label : undefined;
  if (!content?.source_document_id && !name) return null;
  let q = sb
    .from("client_documents")
    .select("id, file_name, storage_path")
    .eq("client_id", clientId)
    .eq("document_type", "support_strategy");
  q = content?.source_document_id
    ? q.eq("id", content.source_document_id)
    : q.eq("file_name", name);
  const { data } = await q.order("uploaded_at", { ascending: false }).limit(1);
  const row = (data ?? [])[0] as
    | { id: string; file_name: string; storage_path: string | null }
    | undefined;
  return row?.storage_path ? { ...row, storage_path: row.storage_path } : null;
}

export const markStrategiesSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        planId: z.string().uuid(),
        sentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnySupabase;
    const userId = context.userId as string;
    const client = await editableClient(sb, userId, data.clientId);
    if (data.sentOn > denverYmd()) throw new Error("The date sent can't be in the future.");

    const { data: plans } = await sb
      .from("client_plans")
      .select("id, client_id, start_date, end_date, activated_on, status, created_at")
      .eq("client_id", client.id);
    const plan = currentPlan((plans ?? []) as ClientPlan[]);
    if (!plan || plan.id !== data.planId) {
      throw new Error("Strategies are sent for the current plan year only.");
    }
    const { data: training } = await sb
      .from("client_specific_trainings")
      .select("content, status, approved_at")
      .eq("client_id", client.id)
      .eq("training_type", "support_strategies")
      .maybeSingle();
    const content = (training?.content ?? null) as CSTContent | null;
    // An uploaded document (or strategies copied from one) is the official copy.
    const uploaded = !!content && (isUploadDoc(content) || !!content.source_document_id);
    if (!uploaded && !strategiesApprovedFor(training ?? null, plan)) {
      throw new Error("Approve the support strategies for this plan year first.");
    }

    // A copy of what was sent, filed as Evidence.
    const item = await strategiesItem(sb, userId, client);
    let evidenceFileId: string | null = null;
    if (item) {
      let bytes: Blob | Uint8Array;
      let filename: string;
      let contentType = "application/pdf";
      if (uploaded) {
        const doc = await uploadedStrategiesDoc(sb, client.id, content);
        if (!doc) throw new Error("The uploaded strategies document wasn't found.");
        const dl = await sb.storage.from("client-documents").download(doc.storage_path);
        if (dl.error || !dl.data)
          throw new Error(dl.error?.message ?? "The uploaded file wasn't found.");
        bytes = dl.data as Blob;
        filename = doc.file_name;
        contentType = (dl.data as Blob).type || "application/octet-stream";
      } else {
        const out = await loadStrategiesDocument(sb, client);
        bytes = out.pdf;
        filename = out.filename;
      }
      const path = `${client.organization_id}/${item.id}/${Date.now()}-${filename.replace(/[^\w.-]+/g, "_")}`;
      const up = await sb.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, bytes, { contentType, upsert: false });
      if (up.error) throw new Error(up.error.message);
      evidenceFileId = await saveUploadOnItem(sb, true, {
        organizationId: client.organization_id,
        userId,
        item,
        storagePath: path,
        filename,
        // An editor recording the send is filing it.
        accepted: true,
        documentDate: data.sentOn,
        notes: "Sent to the support coordinator",
      });
    }

    const { error } = await sb.from("client_strategy_sends").insert({
      organization_id: client.organization_id,
      client_id: client.id,
      plan_id: plan.id,
      source: uploaded ? "upload" : "nectar",
      sent_on: data.sentOn,
      sent_to: await coordinatorName(sb, client.id),
      evidence_file_id: evidenceFileId,
      recorded_by: userId,
    });
    if (error) {
      throw new Error(
        /duplicate|unique/i.test(error.message)
          ? "These strategies are already marked as sent for this plan year."
          : error.message,
      );
    }
    return { ok: true };
  });

export const voidStrategiesSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sendId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as AnySupabase;
    const userId = context.userId as string;
    const { data: send, error } = await sb
      .from("client_strategy_sends")
      .select("id, client_id, evidence_file_id, voided_at")
      .eq("id", data.sendId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!send) throw new Error("Send not found.");
    await editableClient(sb, userId, send.client_id);
    if (send.voided_at) return { ok: true };
    const { data: voided, error: vErr } = await sb
      .from("client_strategy_sends")
      .update({ voided_at: new Date().toISOString(), voided_by: userId })
      .eq("id", send.id)
      .is("voided_at", null)
      .select("id");
    if (vErr) throw new Error(vErr.message);
    if (!voided?.length) throw new Error("Couldn't undo the send.");
    // The filed copy stays on record (the rule no longer counts it); say why.
    if (send.evidence_file_id) {
      await sb
        .from("evidence_files")
        .update({ notes: "Sent to the support coordinator (undone)" })
        .eq("id", send.evidence_file_id);
    }
    return { ok: true };
  });
