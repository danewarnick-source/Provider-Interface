// Add client: the one write path for a new client (form → clients row,
// authorizations, contacts, home pin). The spreadsheet import saves each row
// through addClient too. Every call checks assertCanManageClient first.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IMPORT_MAX_ROWS } from "@/lib/team-members/add-member";
import { assertCanManageClient } from "./guards.server";
import { cleanContactFields } from "./contacts";
import {
  addClientFormSchema,
  authorizationRows,
  clientValues,
  contactRows,
  findMedicaidDuplicate,
  formProblems,
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

export type MedicaidMatch = ExistingClient & { medicaidId: string };

/** For each Medicaid ID given, the client here already using it (if any). */
async function medicaidMatches(
  sb: Sb,
  organizationId: string,
  medicaidIds: readonly string[],
): Promise<MedicaidMatch[]> {
  const wanted = medicaidIds.filter((m) => m.trim());
  if (!wanted.length) return [];
  const { data, error } = await sb
    .from("clients")
    .select("id, first_name, last_name, medicaid_id")
    .eq("organization_id", organizationId)
    .not("medicaid_id", "is", null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    first_name: string;
    last_name: string;
    medicaid_id: string | null;
  }>;
  return wanted.flatMap((medicaidId) => {
    const hit = findMedicaidDuplicate(medicaidId, rows);
    return hit
      ? [{ medicaidId, id: hit.id, name: `${hit.first_name} ${hit.last_name}`.trim() }]
      : [];
  });
}

const orgScope = { organizationId: z.string().uuid() };

/** Clients here already using any of these Medicaid IDs (Add client and the spreadsheet import). */
export const findClientsByMedicaidIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ ...orgScope, medicaidIds: z.array(z.string().max(50)).min(1).max(IMPORT_MAX_ROWS) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<MedicaidMatch[]> => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({
      supabase: sb,
      actorId: userId,
      organizationId: data.organizationId,
      action: "create",
    });
    return medicaidMatches(sb, data.organizationId, data.medicaidIds);
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

export type AddClientResult =
  | { status: "created"; id: string; pinFound: boolean }
  | { status: "duplicate"; existing: ExistingClient }
  | { status: "invalid"; problems: string[] };

/** Save the Add client form. */
export const addClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...orgScope, form: addClientFormSchema }).parse(d))
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
    const [existing] = await medicaidMatches(sb, organizationId, [form.medicaid_id]);
    if (existing)
      return { status: "duplicate", existing: { id: existing.id, name: existing.name } };

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
    return { status: "created", id, pinFound };
  });
