// Filing a PCSP that was used: the client_documents row the plan points at
// (the PDF the browser uploaded once), and the Client file's "Current PCSP on
// file" Evidence row, dated with the plan year. Callers check access first.

import {
  ITEM_SELECT_WITH_DUE,
  normalizeItem,
  type AnySupabase,
} from "@/lib/evidence/store.server";
import { saveUploadOnItem } from "@/lib/evidence/record-upload.server";
import type { EvidenceItemRow } from "@/lib/evidence/types";
import { applyClientPackPlan, loadClientFileView } from "../file-packs.server";
import { assertRowsChanged } from "../writes";
import { PCSP_BUCKET } from "./read-pdf.server";
import type { FiledOutcome } from "./read-report";

const EVIDENCE_BUCKET = "evidence-files";
const PCSP_KEY = "client_pcsp";

export interface PcspFile {
  organizationId: string;
  clientId: string;
  userId: string;
  fileName: string;
  storagePath: string;
}

/** The client_documents row for an uploaded PCSP (dated with the plan year when it has one). */
export async function insertPcspDocument(
  sb: AnySupabase,
  f: PcspFile & { sizeBytes: number | null; start: string | null; end: string | null },
): Promise<string> {
  const dated = f.start && f.end;
  const { data, error } = await sb
    .from("client_documents")
    .insert({
      organization_id: f.organizationId,
      client_id: f.clientId,
      document_type: "pcsp",
      file_name: f.fileName,
      file_url: f.storagePath,
      storage_path: f.storagePath,
      file_size_bytes: f.sizeBytes,
      uploaded_by: f.userId,
      ...(dated
        ? { effective_from: f.start, effective_to: f.end, effective_to_mode: "fixed_date", date_source: "from_document" }
        : {}),
    })
    .select("id");
  if (error) throw new Error(error.message);
  return (assertRowsChanged(data as unknown[])[0] as { id: string }).id;
}

async function pcspItem(sb: AnySupabase, organizationId: string, clientId: string) {
  const { data, error } = await sb
    .from("evidence_items")
    .select(ITEM_SELECT_WITH_DUE)
    .eq("organization_id", organizationId)
    .eq("subject_type", "client")
    .eq("subject_id", clientId)
    .eq("requirement_key", PCSP_KEY)
    .is("opted_out_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeItem(data as EvidenceItemRow) : null;
}

/**
 * Put the PCSP on the client's "Current PCSP on file" row (Evidence), dated
 * with the plan year (document date = start, next due = end). The file is
 * the same upload, copied into Evidence storage on the server. When the
 * agency hasn't applied client packs there is no such row ("no_file_row"):
 * the PCSP still counts as on file from Plans.
 */
export async function fileCurrentPcsp(
  sb: AnySupabase,
  f: PcspFile & { start: string | null; end: string | null },
): Promise<FiledOutcome> {
  try {
    // A new client's file rows are added when their packs are first applied.
    const view = await loadClientFileView(sb, f.organizationId, f.clientId);
    if (view.pending) await applyClientPackPlan(sb, f.userId, f.organizationId, f.clientId, view);
    const item = await pcspItem(sb, f.organizationId, f.clientId);
    if (!item) return "no_file_row";

    const { data: blob, error: dlErr } = await sb.storage.from(PCSP_BUCKET).download(f.storagePath);
    if (dlErr || !blob) throw new Error(dlErr?.message ?? "the uploaded PDF wasn't found");
    const safe = f.fileName.replace(/[^\w.-]+/g, "_");
    const path = `${f.organizationId}/${item.id}/${Date.now()}-${safe}`;
    const up = await sb.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, blob, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error(up.error.message);

    await saveUploadOnItem(sb, true, {
      organizationId: f.organizationId,
      userId: f.userId,
      item,
      storagePath: path,
      filename: f.fileName,
      // The person who confirmed the PCSP review is filing it.
      accepted: true,
      documentDate: f.start,
      nextDueOn: f.end,
    });
    return "filed";
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
