// Monthly MAR sign-off behind mar.functions.ts: who may correct a dose,
// where the signed PDF is stored, and the review rows. Callers run
// assertCanManageClient(edit_medical) first and pass the service client.
// A signed month can't change; reopening needs a reason and is logged in
// medication_month_review_events (the database refuses anything else).

import type { Sb } from "./meds-write.ts";
import { medicationFolder } from "./med-files.ts";
import { canSignOffMonth, monthEnd, monthStart } from "./mar-month.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Who may add a correction to a logged dose: someone with medical edit
 * rights ("editor"), or the person who logged it within 24 hours
 * ("logger"); otherwise null.
 */
export function correctionAccess(a: {
  log: { staff_id: string | null; created_at: string | null };
  userId: string;
  canEditMedical: boolean;
  now?: Date;
}): "editor" | "logger" | null {
  if (a.canEditMedical) return "editor";
  const logged = Date.parse(a.log.created_at ?? "");
  const now = (a.now ?? new Date()).getTime();
  if (a.log.staff_id === a.userId && Number.isFinite(logged) && now - logged <= DAY_MS)
    return "logger";
  return null;
}

/** <orgId>/<clientId>/medications/mar-2026-09-<id>.pdf */
export function marMonthPdfPath(orgId: string, clientId: string, month: string, id: string) {
  return `${medicationFolder(orgId, clientId)}mar-${month}-${id}.pdf`;
}

export function marMonthFileName(client: string, monthLabel: string): string {
  const safe = `MAR ${monthLabel} ${client}`
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100);
  return `${safe || "MAR"}.pdf`;
}

export interface ReviewRow {
  id: string;
  status: string;
  pdf_path: string | null;
}

export async function loadReview(sb: Sb, clientId: string, month: string) {
  const { data, error } = await sb
    .from("medication_month_reviews")
    .select("id, status, pdf_path")
    .eq("client_id", clientId)
    .eq("month", monthStart(month))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ReviewRow | null;
}

/** Why this month can't be signed off now, or null when it can. */
export function signOffProblem(
  month: string,
  existing: ReviewRow | null,
  now: Date = new Date(),
): string | null {
  if (!canSignOffMonth(month, now)) return "You can sign off a month after its last day.";
  if (existing?.status === "signed") return "This month is already signed off.";
  return null;
}

/** Files the signed PDF in the client's documents. Returns the document id. */
export async function fileMarDocument(
  sb: Sb,
  a: {
    orgId: string;
    clientId: string;
    month: string;
    userId: string;
    userName: string;
    fileName: string;
    path: string;
    bytes: number;
    replacesPath: string | null;
    now: Date;
  },
): Promise<string> {
  const { data, error } = await sb
    .from("client_documents")
    .insert({
      organization_id: a.orgId,
      client_id: a.clientId,
      document_type: "mar_month",
      file_name: a.fileName,
      file_url: a.path,
      storage_path: a.path,
      file_size_bytes: a.bytes,
      uploaded_by: a.userId,
      uploaded_by_name: a.userName,
      effective_from: monthStart(a.month),
      effective_to: monthEnd(a.month),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string }).id;
  if (a.replacesPath) {
    const { error: upErr } = await sb
      .from("client_documents")
      .update({ superseded_by: id, superseded_at: a.now.toISOString() })
      .eq("client_id", a.clientId)
      .eq("storage_path", a.replacesPath);
    if (upErr) throw new Error(upErr.message);
  }
  return id;
}

async function logEvent(
  sb: Sb,
  e: {
    orgId: string;
    clientId: string;
    reviewId: string;
    month: string;
    action: "sign" | "reopen";
    userId: string;
    reason?: string | null;
    pdfPath?: string | null;
  },
) {
  const { error } = await sb.from("medication_month_review_events").insert({
    organization_id: e.orgId,
    client_id: e.clientId,
    review_id: e.reviewId,
    month: monthStart(e.month),
    action: e.action,
    actor_id: e.userId,
    reason: e.reason ?? null,
    pdf_path: e.pdfPath ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Saves the sign-off (new, or a reopened month signed again) and logs it. */
export async function saveSignOff(
  sb: Sb,
  a: {
    orgId: string;
    clientId: string;
    month: string;
    userId: string;
    notes: string | null;
    pdfPath: string;
    existing: ReviewRow | null;
    now: Date;
  },
): Promise<string> {
  const row = {
    status: "signed",
    reviewed_by: a.userId,
    reviewed_at: a.now.toISOString(),
    notes: a.notes?.trim() || null,
    pdf_path: a.pdfPath,
  };
  let id: string;
  if (a.existing) {
    const { error } = await sb.from("medication_month_reviews").update(row).eq("id", a.existing.id);
    if (error) throw new Error(error.message);
    id = a.existing.id;
  } else {
    const { data, error } = await sb
      .from("medication_month_reviews")
      .insert({
        ...row,
        organization_id: a.orgId,
        client_id: a.clientId,
        month: monthStart(a.month),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = (data as { id: string }).id;
  }
  await logEvent(sb, { ...a, reviewId: id, action: "sign", pdfPath: a.pdfPath });
  return id;
}

/** Reopens a signed month (reason required) and logs it. */
export async function reopenMonth(
  sb: Sb,
  a: { orgId: string; clientId: string; month: string; userId: string; reason: string; now?: Date },
): Promise<void> {
  const reason = a.reason.trim();
  if (!reason) throw new Error("Add a reason for reopening this month.");
  const existing = await loadReview(sb, a.clientId, a.month);
  if (!existing || existing.status !== "signed") throw new Error("This month isn't signed off.");
  const { error } = await sb
    .from("medication_month_reviews")
    .update({
      status: "reopened",
      reopened_at: (a.now ?? new Date()).toISOString(),
      reopened_by: a.userId,
      reopen_reason: reason,
    })
    .eq("id", existing.id);
  if (error) throw new Error(error.message);
  await logEvent(sb, { ...a, reviewId: existing.id, action: "reopen", reason });
}
