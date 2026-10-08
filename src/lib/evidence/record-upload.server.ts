// Save a stored file on an Evidence item: a new evidence_files row (earlier
// files stay on record), the item's document date and next due date, and the
// same on its dual-link peer. Shared by recordEvidenceUpload (Evidence and
// the Client file) and filing a confirmed PCSP. Callers check access first.

import { applyDueDraft, parseIsoDate } from "./due.ts";
import { insertFileRow, newId, nowIso, patchItem, type AnySupabase } from "./store.server.ts";
import type { EvidenceFileRow, EvidenceItemRow } from "./types.ts";

export interface UploadOnItem {
  organizationId: string;
  userId: string;
  item: EvidenceItemRow;
  storagePath: string;
  filename: string;
  /** Accepted on the spot (an admin filing it) or waiting for review. */
  accepted: boolean;
  documentDate?: string | null;
  nextDueOn?: string | null;
  notes?: string | null;
}

/** Returns the new evidence_files id. */
export async function saveUploadOnItem(
  sb: AnySupabase,
  viaTables: boolean,
  u: UploadOnItem,
): Promise<string> {
  const uploadedAt = nowIso();
  const row: EvidenceFileRow = {
    id: newId(),
    organization_id: u.organizationId,
    item_id: u.item.id,
    storage_path: u.storagePath,
    filename: u.filename,
    attested_at: null,
    attested_by: null,
    attestation_text_snapshot: null,
    uploaded_by: u.userId,
    uploaded_at: uploadedAt,
    notes: u.notes ?? null,
    review_status: u.accepted ? "accepted" : "pending",
    reviewed_by: u.accepted ? u.userId : null,
    reviewed_at: u.accepted ? uploadedAt : null,
    review_note: null,
  };
  await insertFileRow(sb, viaTables, u.organizationId, row);
  const found = u.item;
  const documentDate = parseIsoDate(u.documentDate) ?? found.document_date;
  const nextDue =
    parseIsoDate(u.nextDueOn) ??
    applyDueDraft({
      draft: {
        firstDueRule: found.first_due_rule ?? "set_date",
        firstDueOn: found.first_due_on,
        renewYears: found.renew_years,
        nextDueMode: found.renew_years ? "years" : found.next_due_on ? "set_date" : "none",
        nextDueOn: found.next_due_on,
      },
      hireDate: null,
      documentDate,
      hasFile: true,
    }).next_due_on;
  const duePatch = { document_date: documentDate, next_due_on: nextDue, expires_on: nextDue };
  await patchItem(sb, viaTables, u.organizationId, found.id, duePatch);
  if (found.dual_link_peer_id) {
    await patchItem(sb, viaTables, u.organizationId, found.dual_link_peer_id, duePatch);
    await insertFileRow(sb, viaTables, u.organizationId, {
      ...row,
      id: newId(),
      item_id: found.dual_link_peer_id,
    });
  }
  return row.id;
}
