import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { AUTH_KINDS, stripHtmlToText } from "./authoritative-sources.server";

// =============================================================
// Knowledge base sources (web capture, list, mark as a source) and the
// attestation log. The requirements pipeline that drafted
// nectar_requirements from these documents was removed in the Nectar
// rebuild (N2); its rows are archived.
// =============================================================

export const ingestWebSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        url: z.string().url().max(2000),
        title: z.string().min(1).max(200),
        authoritativeKind: z.enum(AUTH_KINDS),
        fiscalYear: z.string().max(20).optional().nullable(),
        effectiveStart: z.string().max(40).optional().nullable(),
        effectiveEnd: z.string().max(40).optional().nullable(),
        assistedSetup: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) {
      return { documentId: "", capturedAt: "", sourceUrl: "", textLength: 0 };
    }
    await requireOrgMembership(supabase, userId, data.organizationId, "admin");


    const parsedUrl = new URL(data.url);
    if (!/^https?:$/.test(parsedUrl.protocol)) {
      throw new Error("Only http:// and https:// URLs are supported.");
    }

    let html = "";
    try {
      const res = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; PI-NECTAR/1.0; +https://hivecompliance.app)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`Page returned HTTP ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("html") && !contentType.includes("text")) {
        throw new Error(
          `URL is not a readable web page (content-type: ${contentType}). If it's a PDF or document download, upload the file directly instead.`,
        );
      }
      html = await res.text();
    } catch (err) {
      throw new Error(
        `Couldn't fetch ${parsedUrl.host}: ${(err as Error).message}`,
      );
    }

    const { title: pageTitle, text } = stripHtmlToText(html);
    const letterCount = (text.match(/[a-zA-Z]/g) ?? []).length;
    if (text.length < 200 || letterCount < 80) {
      throw new Error(
        "NECTAR couldn't read meaningful text from that page. It may be JavaScript-rendered or behind a login. Try a direct, public, text-based URL — or upload the document file.",
      );
    }

    const capturedAt = new Date().toISOString();
    const snapshotBody = `Source URL: ${parsedUrl.toString()}\nCaptured: ${capturedAt}\nPage title: ${pageTitle ?? "—"}\n\n----- BEGIN CAPTURED TEXT -----\n\n${text}`;
    const snapshotBytes = new TextEncoder().encode(snapshotBody);
    const safeHost = parsedUrl.host.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `${data.organizationId}/web-${safeHost}-${Date.now()}.txt`;

    const upload = await supabase.storage
      .from("nectar-documents")
      .upload(objectPath, snapshotBytes, {
        contentType: "text/plain; charset=utf-8",
        upsert: false,
      });
    if (upload.error)
      throw new Error(`Snapshot upload failed: ${upload.error.message}`);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const docType =
      data.authoritativeKind === "state_sow"
        ? "sow"
        : data.authoritativeKind === "provider_contract"
          ? "contract"
          : "other";

    const { data: doc, error: insertErr } = await supabase
      .from("nectar_documents")
      .insert({
        organization_id: data.organizationId,
        owner_kind: "company",
        document_type: docType,
        title: data.title.trim(),
        version: 1,
        is_current: true,
        effective_start: data.effectiveStart ?? null,
        effective_end: data.effectiveEnd ?? null,
        fiscal_year: data.fiscalYear ?? null,
        external_ids: {
          source_url: parsedUrl.toString(),
          source_host: parsedUrl.host,
          captured_at: capturedAt,
        },
        tags: ["authoritative-source", data.authoritativeKind, "web-source"],
        storage_path: objectPath,
        file_name: `${safeHost} (captured ${capturedAt.slice(0, 10)}).txt`,
        mime_type: "text/plain",
        file_size_bytes: snapshotBytes.byteLength,
        source: "web",
        parse_status: "parsed",
        parsed_at: capturedAt,
        raw_text: text.slice(0, 50000),
        is_authoritative_source: true,
        authoritative_kind: data.authoritativeKind,
        assisted_setup_requested: data.assistedSetup ?? false,
        uploaded_by: userId,
        uploaded_by_name:
          (profile?.full_name as string) ?? (profile?.email as string) ?? null,
        metadata: { page_title: pageTitle, captured_at: capturedAt },
      })
      .select("id, title")
      .single();
    if (insertErr || !doc)
      throw new Error(insertErr?.message ?? "Insert failed");

    return {
      documentId: doc.id as string,
      capturedAt,
      sourceUrl: parsedUrl.toString(),
      textLength: text.length,
    };
  });

// ---------- Authoritative sources ----------

export const listAuthoritativeSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { sources: [] };
    // Membership check is a second layer to RLS. Company/state docs only, so client/staff PHI never lists here.
    await requireOrgMembership(supabase, userId, data.organizationId);
    const { data: rows, error } = await supabase
      .from("nectar_documents")
      .select(
        "id, title, document_type, authoritative_kind, fiscal_year, effective_start, effective_end, file_name, uploaded_by_name, created_at, parse_status, is_current, version, is_authoritative_source, metadata",
      )
      .eq("organization_id", data.organizationId)
      .in("owner_kind", ["company", "state"])
      .order("is_authoritative_source", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { sources: rows ?? [] };
  });

export const markAsAuthoritativeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        documentId: z.string().uuid(),
        authoritativeKind: z.enum(AUTH_KINDS),
        isAuthoritative: z.boolean().default(true),
        assistedSetup: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: true };
    const { data: docRow } = await supabase
      .from("nectar_documents")
      .select("organization_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!docRow?.organization_id) throw new Error("Document not found");
    await requireOrgMembership(supabase, userId, docRow.organization_id as string, "admin");
    const update: {
      is_authoritative_source: boolean;
      authoritative_kind: string | null;
      assisted_setup_requested?: boolean;
    } = {
      is_authoritative_source: data.isAuthoritative,
      authoritative_kind: data.isAuthoritative ? data.authoritativeKind : null,
    };
    if (typeof data.assistedSetup === "boolean") {
      update.assisted_setup_requested = data.assistedSetup;
    }
    const { error } = await supabase
      .from("nectar_documents")
      .update(update)
      .eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Attestation log ----------

export const recordAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        scope: z.enum([
          "document_upload",
          "requirement_verify",
          "audit_packet",
          "form_submission",
          "billing_520",
          "generic",
        ]),
        scopeRefId: z.string().uuid().optional().nullable(),
        scopeRefType: z.string().max(60).optional().nullable(),
        statement: z.string().min(10).max(4000),
        contextJson: z.record(z.string(), z.any()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { id: "", attestedAt: "" };
    await requireOrgMembership(supabase, userId, data.organizationId, "staff");
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    const { data: row, error } = await supabase
      .from("nectar_attestations")
      .insert({
        organization_id: data.organizationId,
        user_id: userId,
        user_display_name:
          (profile?.full_name as string) ?? (profile?.email as string) ?? null,
        scope: data.scope,
        scope_ref_id: data.scopeRefId ?? null,
        scope_ref_type: data.scopeRefType ?? null,
        statement: data.statement,
        context: data.contextJson ?? {},
      })
      .select("id, attested_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Insert failed");
    return { id: row.id as string, attestedAt: row.attested_at as string };
  });

export const REDUCED_LIABILITY_NOTICE = `The documents, checklists, and data shown here are generated from materials you uploaded (including your contracts and State Scope of Work) and from information entered by your staff. PI/NECTAR organizes and surfaces this information but does not independently verify its accuracy or guarantee compliance with State requirements. You are strongly encouraged to review all forms and documents for accuracy. By proceeding, you confirm you have reviewed this information and accept responsibility for its accuracy and for your submissions to the State.`;
