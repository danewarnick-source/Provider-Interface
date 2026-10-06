// Add client: the one write path for a new client (form → clients row,
// authorizations, contacts, home pin). Imported Smart Import drafts open the
// same form and finish through here too. Every call checks
// assertCanManageClient first.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { finishImportDraft } from "@/lib/smart-import-commit.functions";
import { assertCanManageClient } from "./guards.server";
import { cleanContactFields } from "./contacts";
import {
  addClientFormSchema,
  authorizationRows,
  clientValues,
  contactRows,
  findMedicaidDuplicate,
  formFromDraftValues,
  formProblems,
  type AddClientForm,
} from "./create";
import { syncHomePinFromAddress } from "./home-pin";
import { pcspBytes, readPcspPdf } from "./pcsp/read-pdf.server";
import type { PcspResult } from "./pcsp/parser-shared";
import { assertRowsChanged } from "./writes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

export type ExistingClient = { id: string; name: string };

async function medicaidDuplicate(
  sb: Sb,
  organizationId: string,
  medicaidId: string,
): Promise<ExistingClient | null> {
  if (!medicaidId.trim()) return null;
  const { data, error } = await sb
    .from("clients")
    .select("id, first_name, last_name, medicaid_id")
    .eq("organization_id", organizationId)
    .not("medicaid_id", "is", null);
  if (error) throw new Error(error.message);
  const hit = findMedicaidDuplicate(
    medicaidId,
    (data ?? []) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      medicaid_id: string | null;
    }>,
  );
  return hit ? { id: hit.id, name: `${hit.first_name} ${hit.last_name}`.trim() } : null;
}

const orgScope = { organizationId: z.string().uuid() };

/** The client already using this Medicaid ID, or null. */
export const findClientByMedicaidId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ...orgScope, medicaidId: z.string().max(50) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ExistingClient | null> => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId: data.organizationId,
      action: "create",
    });
    return medicaidDuplicate(sb, data.organizationId, data.medicaidId);
  });

/** Read a PCSP to fill the form. Saves nothing (the client doesn't exist yet). */
export const readPcspForNewClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ...orgScope, fileBase64: z.string().min(10).max(21_000_000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PcspResult> => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId: data.organizationId,
      action: "create",
    });
    return (await readPcspPdf(sb, data.organizationId, pcspBytes(data.fileBase64))).parse;
  });

/** An imported Smart Import draft as Add client form values. */
export const loadImportDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...orgScope, subjectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ form: AddClientForm; name: string }> => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId: data.organizationId,
      action: "create",
    });
    const { data: subj, error } = await sb
      .from("import_subjects")
      .select("id, display_name")
      .eq("id", data.subjectId)
      .eq("org_id", data.organizationId)
      .is("committed_at", null)
      .is("discarded_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!subj) throw new Error("This imported draft was not found or is already finished.");
    const { data: fields, error: fErr } = await sb
      .from("extracted_fields")
      .select("target_field, value")
      .eq("import_subject_id", data.subjectId)
      .neq("status", "ignored")
      .is("dismissed_at", null);
    if (fErr) throw new Error(fErr.message);
    const values: Record<string, string | null> = {};
    for (const f of (fields ?? []) as Array<{ target_field: string; value: string | null }>)
      values[f.target_field] = f.value;
    return {
      form: formFromDraftValues(values),
      name: (subj as { display_name: string | null }).display_name?.trim() || "Imported client",
    };
  });

export type AddClientResult =
  | { status: "created"; id: string; pinFound: boolean; gaps: string[] }
  | { status: "duplicate"; existing: ExistingClient }
  | { status: "invalid"; problems: string[] };

/** Save the Add client form (optionally finishing an imported draft). */
export const addClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ...orgScope,
        form: addClientFormSchema,
        draftSubjectId: z.string().uuid().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<AddClientResult> => {
    const { sb, userId } = ctx(context);
    const { organizationId, form } = data;
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId,
      action: "create",
    });
    const problems = formProblems(form);
    if (problems.length) return { status: "invalid", problems };
    const existing = await medicaidDuplicate(sb, organizationId, form.medicaid_id);
    if (existing) return { status: "duplicate", existing };

    const { data: rows, error } = await sb
      .from("clients")
      .insert({ ...clientValues(form), organization_id: organizationId })
      .select("id");
    if (error) throw new Error(error.message);
    const [{ id }] = assertRowsChanged(rows as Array<{ id: string }> | null);

    const auths = authorizationRows(form, organizationId, id);
    if (auths.length) {
      const { error: aErr } = await sb
        .from("client_billing_codes")
        .upsert(auths, { onConflict: "organization_id,client_id,service_code" });
      if (aErr) throw new Error(aErr.message);
    }
    const contacts = contactRows(form).map((c) => ({
      ...cleanContactFields(c),
      organization_id: organizationId,
      client_id: id,
      created_by: userId,
    }));
    if (contacts.length) {
      const { error: cErr } = await sb.from("client_contacts").insert(contacts);
      if (cErr) throw new Error(cErr.message);
    }
    let pinFound = false;
    if (form.address.trim()) {
      try {
        pinFound = (
          await syncHomePinFromAddress(sb, {
            clientId: id,
            organizationId,
            address: form.address,
            mode: "on_address_save",
          })
        ).updated;
      } catch {
        pinFound = false;
      }
    }
    const gaps = data.draftSubjectId
      ? await finishImportDraft(sb, userId, {
          subjectId: data.draftSubjectId,
          recordId: id,
          organizationId,
        })
      : [];
    return { status: "created", id, pinFound, gaps };
  });
