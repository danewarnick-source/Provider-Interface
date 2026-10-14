// MAR server functions: the month view, the printout, and the monthly
// sign-off. Every call runs guardClient (assertCanManageClient) first:
// view_medical to read or print, edit_medical to sign off or reopen. The
// PDF is built here on the server; a signed month's PDF is stored in the
// private client-documents bucket under <orgId>/<clientId>/medications/,
// filed in the client's documents (type mar_month) and opened through
// openMedicationFile's one-minute signed link.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clientName, guardClient, medAdmin, type GuardedClient } from "./med-guard.server";
import { MEDICATION_FILE_BUCKET } from "./med-files";
import { loadMarMonth, type MarMonthData } from "./mar-data";
import { canSignOffMonth, longDateTime, monthLabel } from "./mar-month";
import { renderMarPdf } from "./mar-pdf";
import {
  fileMarDocument,
  loadReview,
  marMonthFileName,
  marMonthPdfPath,
  reopenMonth,
  saveSignOff,
  signOffProblem,
} from "./mar-review";
import type { Sb } from "./meds-write";

const MonthInput = z.object({
  clientId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month."),
});

async function header(db: Sb, client: GuardedClient, month: string) {
  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("id", client.organization_id)
    .maybeSingle();
  const allergies = (client.allergies ?? []).filter(Boolean);
  return {
    provider: (org as { name?: string } | null)?.name || "Provider",
    client: clientName(client),
    dob: client.date_of_birth || "Not on file",
    medicaidId: client.medicaid_id || "Not on file",
    month: monthLabel(month),
    allergies: allergies.length ? allergies.join(", ") : "None on file",
  };
}

async function myName(db: Sb, userId: string): Promise<string> {
  const { data } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return (data as { full_name?: string | null } | null)?.full_name || "Staff";
}

function reviewFor(data: MarMonthData) {
  const r = data.review;
  if (!r || r.status !== "signed") return null;
  return { by: r.reviewed_by_name || "Unknown", at: longDateTime(r.reviewed_at), notes: r.notes };
}

export const getMarMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => MonthInput.parse(i))
  .handler(async ({ data, context }) => {
    const { db } = await medAdmin();
    const { client } = await guardClient(context, db, data.clientId, "view_medical");
    const month = await loadMarMonth(db, {
      orgId: client.organization_id,
      clientId: data.clientId,
      month: data.month,
    });
    return { ...month, canSignOff: canSignOffMonth(data.month) };
  });

export const printMarMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => MonthInput.parse(i))
  .handler(async ({ data, context }) => {
    const { db } = await medAdmin();
    const { userId, client } = await guardClient(context, db, data.clientId, "view_medical");
    const [month, head, me] = await Promise.all([
      loadMarMonth(db, {
        orgId: client.organization_id,
        clientId: data.clientId,
        month: data.month,
      }),
      header(db, client, data.month),
      myName(db, userId),
    ]);
    const bytes = await renderMarPdf({
      header: head,
      data: month,
      review: reviewFor(month),
      printed: `Printed ${longDateTime(new Date().toISOString())} by ${me}`,
    });
    return {
      pdfBase64: Buffer.from(bytes).toString("base64"),
      filename: marMonthFileName(head.client, head.month),
    };
  });

export const signOffMarMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => MonthInput.extend({ notes: z.string().max(2000).nullish() }).parse(i))
  .handler(async ({ data, context }) => {
    const { db, storage } = await medAdmin();
    const { userId, client } = await guardClient(context, db, data.clientId, "edit_medical");
    const orgId = client.organization_id;
    const now = new Date();
    const existing = await loadReview(db, data.clientId, data.month);
    const problem = signOffProblem(data.month, existing, now);
    if (problem) throw new Error(problem);
    const [month, head, me] = await Promise.all([
      loadMarMonth(db, { orgId, clientId: data.clientId, month: data.month, now }),
      header(db, client, data.month),
      myName(db, userId),
    ]);
    const signedAt = longDateTime(now.toISOString());
    const bytes = await renderMarPdf({
      header: head,
      data: month,
      review: { by: me, at: signedAt, notes: data.notes?.trim() || null },
      printed: `Signed off ${signedAt} by ${me}`,
    });
    const path = marMonthPdfPath(orgId, data.clientId, data.month, crypto.randomUUID());
    const { error } = await storage
      .from(MEDICATION_FILE_BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (error) throw new Error(error.message);
    await fileMarDocument(db, {
      orgId,
      clientId: data.clientId,
      month: data.month,
      userId,
      userName: me,
      fileName: marMonthFileName(head.client, head.month),
      path,
      bytes: bytes.byteLength,
      replacesPath: existing?.pdf_path ?? null,
      now,
    });
    await saveSignOff(db, {
      orgId,
      clientId: data.clientId,
      month: data.month,
      userId,
      notes: data.notes ?? null,
      pdfPath: path,
      existing,
      now,
    });
    return { pdfPath: path };
  });

export const reopenMarMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => MonthInput.extend({ reason: z.string().trim().min(3).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { db } = await medAdmin();
    const { userId, client } = await guardClient(context, db, data.clientId, "edit_medical");
    await reopenMonth(db, {
      orgId: client.organization_id,
      clientId: data.clientId,
      month: data.month,
      userId,
      reason: data.reason,
    });
    return { ok: true };
  });
