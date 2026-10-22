// Thin server fns used by the client document uploads and NectarAsk. Each one is
// org-scoped via the user's organization_members row for the client.
import { activeContacts, contactsWithRole, loadClientContacts } from "@/lib/clients/contacts/contacts";
import {
  CLIENT_DOCUMENTS_BUCKET,
  PROFILE_COLUMNS,
  actionsForReviewedFields,
  assertReviewableFields,
  buildProposals,
  isClientUploadPath,
  medicationKey,
  reviewableUploadType,
  type ProfileFieldMeta,
  type ReviewField,
  type ReviewJson,
} from "@/lib/clients/create/document-review";
import { assertCanManageClient, type ManageClientAction } from "@/lib/clients/guards.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { denverYmd } from "@/lib/denver-date";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

// ── End-of-life statuses (DNR / POLST / palliative / hospice) ────────────
const EOL_FIELDS = ["dnr_status", "polst_status", "palliative_care_status", "hospice_status"] as const;
type EolField = (typeof EOL_FIELDS)[number];

export const setEndOfLifeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        field: z.enum(EOL_FIELDS),
        status: z.string().min(1).max(80),
        location: z.string().max(200).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId) return { ok: false };
    const orgId = await guardClient(sb, context.userId as string, data.clientId, ["edit_medical"]);
    const patch: Record<string, unknown> = { [data.field as EolField]: data.status };
    if (data.field === "dnr_status") {
      patch.dnr_location = data.location ?? null;
    }
    const { error } = await sb
      .from("clients")
      .update(patch)
      .eq("id", data.clientId)
      .eq("organization_id", orgId);
    if (error) throw error;
    return { ok: true };
  });

// ── Append to clients array fields (allergies, immunizations) ────────────
export const appendClientArrayField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        field: z.enum(["allergies", "immunizations"]),
        value: z.string().min(1).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId) return { ok: false, count: 0 };
    const orgId = await guardClient(sb, context.userId as string, data.clientId, ["edit_medical"]);
    const { data: row } = await sb
      .from("clients")
      .select(data.field)
      .eq("id", data.clientId)
      .eq("organization_id", orgId)
      .maybeSingle();
    const current = (row?.[data.field] as string[] | null) ?? [];
    const next = Array.from(new Set([...current, data.value.trim()]));
    const { error } = await sb
      .from("clients")
      .update({ [data.field]: next })
      .eq("id", data.clientId)
      .eq("organization_id", orgId);
    if (error) throw error;
    return { ok: true, count: next.length };
  });

// ── Uploads to the client: attach, then review-then-apply ───────────────
// attachClientDocument records the file in client_documents straight away, so
// the upload is kept even when the file can't be read. Nectar's reading of
// it is only a proposal: previewClientUpdateFromDocument returns a review
// list and nothing lands in the profile or medications until the person ticks
// rows and applySelectedClientFields runs. Files are read from the fixed
// client-documents bucket and must sit in this client's folder.

async function clientOrgId(sb: Sb, clientId: string): Promise<string> {
  const { data: client, error } = await sb
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!client) throw new Error("Client not found");
  return client.organization_id as string;
}

/** assertCanManageClient for each action; returns the client's agency. */
async function guardClient(
  sb: Sb,
  userId: string,
  clientId: string,
  actions: readonly ManageClientAction[],
): Promise<string> {
  const organizationId = await clientOrgId(sb, clientId);
  for (const action of actions) {
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action });
  }
  return organizationId;
}

/** Whether the caller may also do `action` (no throw). */
async function mayAlso(
  sb: Sb,
  userId: string,
  organizationId: string,
  clientId: string,
  action: ManageClientAction,
): Promise<boolean> {
  try {
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action });
    return true;
  } catch {
    return false;
  }
}

function assertOwnUpload(path: string, orgId: string, clientId: string) {
  if (!isClientUploadPath(path, orgId, clientId)) {
    throw new Error("That file isn't in this client's documents. Upload it again.");
  }
}

export const attachClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        documentType: z.string().min(1).max(80),
        fileName: z.string().min(1).max(300),
        storagePath: z.string().min(1).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId) return { ok: false, id: null };
    const orgId = await guardClient(sb, context.userId as string, data.clientId, ["edit"]);
    assertOwnUpload(data.storagePath, orgId, data.clientId);
    const { data: ins, error } = await sb
      .from("client_documents")
      .insert({
        client_id: data.clientId,
        organization_id: orgId,
        document_type: data.documentType,
        file_name: data.fileName,
        file_url: data.storagePath, // signed URLs are created on demand
        storage_path: data.storagePath,
        uploaded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: ins.id as string };
  });

const PreviewInput = z.object({
  clientId: z.string().uuid(),
  documentType: z.string().min(1).max(80),
  fileName: z.string().min(1).max(300),
  storagePath: z.string().min(1).max(500),
});

export const previewClientUpdateFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PreviewInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId) return { ok: false as const, reason: "Not authenticated." };
    const userId = context.userId as string;
    const orgId = await guardClient(sb, userId, data.clientId, ["edit"]);
    assertOwnUpload(data.storagePath, orgId, data.clientId);
    // Medical rows (medications, allergies, DNR…) only for people who may see them.
    const includeMedical = await mayAlso(sb, userId, orgId, data.clientId, "view_medical");

    const { data: file, error: dlErr } = await sb.storage
      .from(CLIENT_DOCUMENTS_BUCKET)
      .download(data.storagePath);
    if (dlErr || !file) {
      return { ok: false as const, reason: `Could not download file: ${dlErr?.message ?? "no file"}` };
    }
    const buf = Buffer.from(await file.arrayBuffer());

    const { extractTextFromUpload } = await import("@/lib/document-text.server");
    const text = await extractTextFromUpload(buf, data.fileName);
    if (!text || text.trim().length < 20) {
      return {
        ok: false as const,
        reason: "Nectar couldn't read the document text (scanned PDF?). The file is saved; fill values in yourself.",
      };
    }

    const docType = reviewableUploadType(data.documentType) ?? "other";
    const { parseDocumentWithAI } = await import("@/lib/document-extraction");
    const parsed = await parseDocumentWithAI(text, `documentType=${docType}`, orgId);
    const rawFields: ReviewField[] = (parsed.fields ?? []).map((f) => ({
      field_key: f.field_key,
      value_text: f.value_text ?? null,
      value_number: f.value_number ?? null,
      value_date: f.value_date ?? null,
      value_bool: f.value_bool ?? null,
      value_array: f.value_array ?? null,
      value_json: (f.value_json ?? null) as ReviewJson,
      confidence: f.confidence ?? 0.85,
    }));

    const { data: client } = await sb
      .from("clients")
      .select(["id", ...PROFILE_COLUMNS].join(","))
      .eq("id", data.clientId)
      .maybeSingle();
    const row = (client ?? {}) as Record<string, unknown>;
    const contacts = activeContacts(await loadClientContacts(sb, [data.clientId]));
    const currentOf = (meta: ProfileFieldMeta): unknown =>
      "column" in meta
        ? row[meta.column]
        : contactsWithRole(contacts, meta.contact.role)[meta.contact.slot]?.[meta.contact.part];

    let existingMedicationKeys = new Set<string>();
    if (includeMedical) {
      const { data: meds } = await sb
        .from("client_medications")
        .select("medication_name, dosage")
        .eq("organization_id", orgId)
        .eq("client_id", data.clientId);
      existingMedicationKeys = new Set(
        ((meds ?? []) as Array<{ medication_name: string | null; dosage: string | null }>).map((m) =>
          medicationKey(m.medication_name, m.dosage),
        ),
      );
    }

    const proposals = buildProposals({ fields: rawFields, currentOf, existingMedicationKeys, includeMedical });
    return { ok: true as const, proposals };
  });

const ApplySelectedInput = z.object({
  clientId: z.string().uuid(),
  fields: z.array(
    z.object({
      field_key: z.string().min(1).max(120),
      value_text: z.string().nullable().optional(),
      value_number: z.number().nullable().optional(),
      value_date: z.string().nullable().optional(),
      value_bool: z.boolean().nullable().optional(),
      value_array: z.array(z.string()).nullable().optional(),
      value_json: z.unknown().optional(),
      confidence: z.number().nullable().optional(),
    }),
  ).max(200),
});

export const applySelectedClientFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ApplySelectedInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId)
      return { ok: false, autofilled: 0, suggested: 0, customCreated: 0, appliedCount: 0 };
    // Only rows a review can show (profile fields and medications); never
    // billing codes, goals or home. Medical rows need Client medical: Edit.
    assertReviewableFields(data.fields);
    const orgId = await guardClient(
      sb,
      context.userId as string,
      data.clientId,
      actionsForReviewedFields(data.fields),
    );

    const fields = data.fields.map((f) => ({
      field_key: f.field_key,
      value_text: f.value_text ?? null,
      value_number: f.value_number ?? null,
      value_date: f.value_date ?? null,
      value_bool: f.value_bool ?? null,
      value_array: f.value_array ?? null,
      value_json: f.value_json ?? null,
      confidence: f.confidence ?? 0.95,
    }));

    const { applyExtractedFieldsToClient } = await import("@/lib/clients/create/import-schema");
    const summary = await applyExtractedFieldsToClient({
      supabase: sb,
      organizationId: orgId,
      clientId: data.clientId,
      fields,
      // "profile_update" is outside the SourceDocumentType union but the
      // helper only uses it for downstream conflict tagging — cast is safe.
      sourceDocumentType: "profile_update" as unknown as import("@/lib/clients/create/import-fields").SourceDocumentType,
      onError: async (action, message) => {
        try {
          await sb.from("import_audit").insert({
            org_id: orgId,
            item: `[profile-update] ${message}`,
            traces_to: "admin_review",
            actor: context.userId,
            action,
          });
        } catch { /* never let audit failure break a save */ }
      },
    });

    return {
      ok: true,
      autofilled: summary.autofilled,
      suggested: summary.suggested,
      customCreated: summary.customCreated,
      appliedCount: fields.length,
    };
  });

// ── SOW supplemental: level of need ────────────────────────────────────
export const setLevelOfNeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      value: z.string().max(120).nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId) return { ok: false };
    const orgId = await guardClient(sb, context.userId as string, data.clientId, ["edit"]);
    const { error } = await sb
      .from("clients")
      .update({ level_of_need: data.value?.trim() || null })
      .eq("id", data.clientId)
      .eq("organization_id", orgId);
    if (error) throw error;
    return { ok: true };
  });

// ── Grievance policy acknowledgment (SOW §1.10(11)) ─────────────────────
export const setGrievanceAcknowledgment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      acknowledged: z.boolean(),
      signedDate: z.string().max(40).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId) return { ok: false };
    const orgId = await guardClient(sb, context.userId as string, data.clientId, ["edit"]);
    const patch: Record<string, unknown> = {
      grievance_acknowledged: data.acknowledged,
      grievance_signed_date: data.acknowledged ? (data.signedDate || denverYmd()) : null,
    };
    const { error } = await sb
      .from("clients")
      .update(patch)
      .eq("id", data.clientId)
      .eq("organization_id", orgId);
    if (error) throw error;
    return { ok: true };
  });

// ── HRC chain (rights restrictions, SOW §1.20) ──────────────────────────
// Uses the existing hrc_reviews table — no new columns on clients.
export const listHrcReviewsForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ clientId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId) return { reviews: [] };
    const orgId = await guardClient(sb, context.userId as string, data.clientId, ["view_hrc"]);
    const { data: rows, error } = await sb
      .from("hrc_reviews")
      .select("id, restriction_summary, status, created_at")
      .eq("client_id", data.clientId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { reviews: rows ?? [] };
  });

export const createHrcReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      clientId: z.string().uuid(),
      restriction_summary: z.string().min(1).max(2000),
      status: z.string().min(1).max(40).default("pending"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId) return { ok: false, review: null };
    const orgId = await guardClient(sb, context.userId as string, data.clientId, ["edit_hrc"]);
    const { data: ins, error } = await sb
      .from("hrc_reviews")
      .insert({
        organization_id: orgId,
        client_id: data.clientId,
        restriction_summary: data.restriction_summary,
        status: data.status,
        created_by: context.userId,
      })
      .select("id, status, restriction_summary")
      .single();
    if (error) throw error;
    return { ok: true, review: ins };
  });

// ── Signed-URL fetch for a client_documents row (profile downloads) ─────
export const signClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      documentId: z.string().uuid(),
      expiresIn: z.number().int().positive().max(3600).default(300),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    if (!sb || !context.userId) return { url: null, fileName: null };
    const { data: doc } = await sb
      .from("client_documents")
      .select("id, client_id, storage_path, file_url, file_name")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    // Admin level (unchanged) plus the client guard: in this agency and in scope.
    const docOrg = await guardClient(sb, context.userId as string, doc.client_id as string, ["view"]);
    await requireOrgMembership(sb, context.userId as string, docOrg, "admin");
    const path = (doc.storage_path as string) || (doc.file_url as string);
    if (!path) throw new Error("Document has no storage path");
    const { data: signed, error } = await sb.storage
      .from("client-documents")
      .createSignedUrl(path, data.expiresIn);
    if (error) throw error;
    return { url: signed.signedUrl as string, fileName: doc.file_name as string };
  });
