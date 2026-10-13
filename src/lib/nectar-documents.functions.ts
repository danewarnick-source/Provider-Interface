import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { DOC_TYPES, OWNER_KINDS, runIngest } from "@/lib/nectar/library/ingest";
import { ingestDeps } from "@/lib/nectar/library/ingest.server";

// =============================================================
// NECTAR Universal Document Store — server functions
// All other features (billing rate auto-fill, audit auto-pull,
// monthly billing support docs, etc.) read from this layer.
// =============================================================

const OwnerKind = z.enum(OWNER_KINDS);

// =============================================================
// 1. INGEST — upload + parse
// Pipeline and rules live in src/lib/nectar/library/ingest.ts: owner or
// agency-wide admin only (checked before storage), no client-field
// extraction for Knowledge base uploads, client autofill only for a
// client-profile upload.
// =============================================================

export const ingestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        ownerKind: OwnerKind,
        clientId: z.string().uuid().optional().nullable(),
        staffId: z.string().uuid().optional().nullable(),
        documentType: z.enum(DOC_TYPES).default("other"),
        category: z.string().max(40).optional().nullable(),
        title: z.string().min(1).max(200),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(120).optional().nullable(),
        fileBase64: z.string().min(10),
        fiscalYear: z.string().max(20).optional().nullable(),
        effectiveStart: z.string().max(40).optional().nullable(),
        effectiveEnd: z.string().max(40).optional().nullable(),
        medicaidId: z.string().max(50).optional().nullable(),
        tags: z.array(z.string().max(40)).max(20).default([]),
        externalIds: z.record(z.string(), z.string().max(120)).optional(),
        parentDocumentId: z.string().uuid().optional().nullable(),
        autoParse: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return null;
    return runIngest(data, ingestDeps(supabase, userId, data.organizationId));
  });

// =============================================================
// 2. RETRIEVAL API
// =============================================================

export const queryDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        ownerKind: OwnerKind.optional(),
        clientId: z.string().uuid().optional().nullable(),
        staffId: z.string().uuid().optional().nullable(),
        documentType: z.string().max(40).optional(),
        fiscalYear: z.string().max(20).optional(),
        tag: z.string().max(40).optional(),
        search: z.string().max(120).optional(),
        currentOnly: z.boolean().default(true),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { documents: [] };
    // Second layer to RLS: an active member of the organization being read.
    await requireOrgMembership(supabase, userId, data.organizationId);
    let q = supabase
      .from("nectar_documents")
      .select(
        "id, owner_kind, client_id, staff_id, document_type, category, title, version, is_current, effective_start, effective_end, fiscal_year, medicaid_id, tags, file_name, mime_type, parse_status, uploaded_by_name, uploaded_at:created_at, created_at, storage_path",
      )
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.currentOnly) q = q.eq("is_current", true);
    if (data.ownerKind) q = q.eq("owner_kind", data.ownerKind);
    if (data.clientId) q = q.eq("client_id", data.clientId);
    if (data.staffId) q = q.eq("staff_id", data.staffId);
    if (data.documentType) q = q.eq("document_type", data.documentType);
    if (data.fiscalYear) q = q.eq("fiscal_year", data.fiscalYear);
    if (data.tag) q = q.contains("tags", [data.tag]);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { documents: rows ?? [] };
  });

export const getDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return null;
    const { data: doc, error } = await supabase
      .from("nectar_documents")
      .select("*")
      .eq("id", data.documentId)
      .single();
    if (error || !doc) throw new Error(error?.message ?? "Not found");
    // Second layer to RLS: nothing about the document leaves unless the caller
    // is an active member of its organization.
    await requireOrgMembership(supabase, userId, doc.organization_id);

    const { data: fields } = await supabase
      .from("nectar_extracted_fields")
      .select("*")
      .eq("document_id", data.documentId)
      .order("field_group", { ascending: true, nullsFirst: true })
      .order("field_key", { ascending: true });

    // Version history (walk parent chain — simple: same title or shared parent)
    const rootId = (doc.parent_document_id as string | null) ?? doc.id;
    const { data: versions } = await supabase
      .from("nectar_documents")
      .select("id, version, is_current, created_at, uploaded_by_name, file_name")
      .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`)
      .order("version", { ascending: false });

    // Signed url
    let signedUrl: string | null = null;
    const signed = await supabase.storage
      .from(doc.storage_bucket as string)
      .createSignedUrl(doc.storage_path as string, 60 * 30);
    signedUrl = signed.data?.signedUrl ?? null;

    return { document: doc, fields: fields ?? [], versions: versions ?? [], signedUrl };
  });

// Targeted retrieval: structured fields by document + field_key — drives
// downstream features like rate auto-fill.
export const getExtractedFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        clientId: z.string().uuid().optional().nullable(),
        documentType: z.string().max(40).optional(),
        fieldGroup: z.string().max(80).optional(),
        fieldKey: z.string().max(80).optional(),
        confirmedOnly: z.boolean().default(false),
        currentOnly: z.boolean().default(true),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!supabase) return { fields: [] };
    let docQ = supabase
      .from("nectar_documents")
      .select("id")
      .eq("organization_id", data.organizationId);
    if (data.clientId) docQ = docQ.eq("client_id", data.clientId);
    if (data.documentType) docQ = docQ.eq("document_type", data.documentType);
    if (data.currentOnly) docQ = docQ.eq("is_current", true);
    const { data: docs } = await docQ;
    const ids = (docs ?? []).map((d) => d.id as string);
    if (!ids.length) return { fields: [] };

    let fQ = supabase
      .from("nectar_extracted_fields")
      .select("*")
      .in("document_id", ids)
      .limit(data.limit);
    if (data.fieldGroup) fQ = fQ.eq("field_group", data.fieldGroup);
    if (data.fieldKey) fQ = fQ.eq("field_key", data.fieldKey);
    if (data.confirmedOnly) fQ = fQ.eq("status", "confirmed");
    const { data: rows, error } = await fQ;
    if (error) throw new Error(error.message);
    return { fields: rows ?? [] };
  });

// =============================================================
// 3. SOURCE-OF-TRUTH — confirm / override extracted field
// =============================================================

export const reviewExtractedField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fieldId: z.string().uuid(),
        action: z.enum(["confirm", "override", "reject"]),
        overrideValue: z
          .object({
            value_text: z.string().max(2000).optional().nullable(),
            value_number: z.number().optional().nullable(),
            value_date: z.string().max(40).optional().nullable(),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    // Resolve org via the field → document; verify caller is a manager+ there.
    const { data: fieldRow } = await supabase
      .from("nectar_extracted_fields")
      .select("organization_id")
      .eq("id", data.fieldId)
      .maybeSingle();
    if (!fieldRow?.organization_id) throw new Error("Extracted field not found");
    await requireOrgMembership(supabase, userId, fieldRow.organization_id as string, "admin");
    const update: Record<string, unknown> = {
      status: data.action === "confirm" ? "confirmed" : data.action === "override" ? "overridden" : "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    };
    if (data.action === "override" && data.overrideValue) {
      update.override_value = data.overrideValue;
      if (data.overrideValue.value_text !== undefined) update.value_text = data.overrideValue.value_text;
      if (data.overrideValue.value_number !== undefined) update.value_number = data.overrideValue.value_number;
      if (data.overrideValue.value_date !== undefined) update.value_date = data.overrideValue.value_date;
    }
    const { error } = await supabase
      .from("nectar_extracted_fields")
      .update(update as never)
      .eq("id", data.fieldId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    const { data: doc } = await supabase
      .from("nectar_documents")
      .select("storage_path, storage_bucket, organization_id, client_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!doc?.organization_id) throw new Error("Document not found");
    await requireOrgMembership(supabase, userId, doc.organization_id as string, "admin");
    if (doc.client_id) {
      throw new Error(
        "Client records can't be deleted. Remove it from the client's Files tab instead — it moves to Outdated and is kept for audits.",
      );
    }
    if (doc?.storage_path) {
      await supabase.storage.from(doc.storage_bucket as string).remove([doc.storage_path as string]);
    }
    // Retract unconfirmed requirements drafted from this source so they stop
    // appearing in "needs attention" once the source document is gone.
    // Confirmed requirements are left alone (they represent human-attested obligations).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: reqErr } = await (supabase as any)
      .from("nectar_requirements")
      .update({ review_status: "removed", updated_at: new Date().toISOString() })
      .eq("source_document_id", data.documentId)
      .neq("review_status", "confirmed");
    if (reqErr) throw new Error(reqErr.message);
    const { error } = await supabase.from("nectar_documents").delete().eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
