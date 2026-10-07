// Add client's writes, shared by Add client (by hand and from a PCSP) and
// the spreadsheet import: the clients row, authorizations, contacts and the
// home pin. Callers run assertCanManageClient first.

import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanContactFields } from "./contacts";
import {
  authorizationRows,
  clientValues,
  contactRows,
  findMedicaidDuplicate,
  formProblems,
  type AddClientForm,
} from "./create";
import { syncHomePinFromAddress } from "./home-pin";
import { assertRowsChanged } from "./writes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

export type ExistingClient = { id: string; name: string };

export type MedicaidMatch = ExistingClient & { medicaidId: string };

/** For each Medicaid ID given, the client here already using it (if any). */
export async function medicaidMatches(
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

export type AddClientResult =
  | { status: "created"; id: string; pinFound: boolean }
  | { status: "duplicate"; existing: ExistingClient }
  | { status: "invalid"; problems: string[] };

/** Check and save the Add client form. */
export async function createClientFromForm(
  sb: Sb,
  userId: string,
  organizationId: string,
  form: AddClientForm,
): Promise<AddClientResult> {
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
}
