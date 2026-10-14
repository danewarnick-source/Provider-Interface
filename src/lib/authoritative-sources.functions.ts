import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { libraryGroupForKind } from "@/lib/nectar/library/library";
import { AUTH_KINDS } from "./authoritative-sources.server";

// =============================================================
// Mark an uploaded document as a source, and the attestation log. The
// requirements pipeline that drafted nectar_requirements from these
// documents was removed in the Nectar rebuild (N2); its rows are archived.
// The old Knowledge page's web capture and source list went with that page
// in N4 (the Knowledge base library replaced them).
// =============================================================

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
      .select("organization_id, owner_kind")
      .eq("id", data.documentId)
      .maybeSingle();
    if (!docRow?.organization_id) throw new Error("Document not found");
    await requireOrgMembership(supabase, userId, docRow.organization_id as string, "admin");
    const update: {
      is_authoritative_source: boolean;
      authoritative_kind: string | null;
      library_group?: string;
      assisted_setup_requested?: boolean;
    } = {
      is_authoritative_source: data.isAuthoritative,
      authoritative_kind: data.isAuthoritative ? data.authoritativeKind : null,
    };
    // Knowledge base uploads join the library in the group their kind belongs
    // to: a "Policy / procedure" upload is an agency policy (N3).
    if (data.isAuthoritative && docRow.owner_kind === "company") {
      update.library_group = libraryGroupForKind(data.authoritativeKind);
    }
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
