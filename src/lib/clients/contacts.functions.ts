// Client contacts: list / add / update / end. Every write runs
// assertCanManageClient first, then writes with the caller's own (RLS-scoped)
// Supabase client and confirms a row really changed. Contacts are ended
// (ended_on), never deleted.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import { assertRowsChanged } from "./writes";
import {
  CLIENT_CONTACT_COLUMNS,
  CONTACT_ROLES,
  cleanContactFields,
  loadClientContacts,
  type ClientContact,
} from "./contacts";
import { todayYmd } from "./dates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const text = z.string().max(2000).nullish();
const fieldsSchema = z.object({
  role: z.enum(CONTACT_ROLES),
  name: z.string().max(200),
  relationship: text,
  phone: text,
  email: text,
  address: text,
  company: text,
  notes: text,
  is_primary: z.boolean().optional(),
});

const scope = { organizationId: z.string().uuid(), clientId: z.string().uuid() };

/** Every contact for one client, ended ones included (the UI hides them). */
export const listClientContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object(scope).parse(d))
  .handler(async ({ data, context }): Promise<ClientContact[]> => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({ supabase: sb, actorId: userId, ...data, action: "view" });
    return loadClientContacts(sb, [data.clientId]);
  });

/** Only one primary per role: clear the flag on the client's other contacts with that role. */
async function clearOtherPrimary(sb: Sb, clientId: string, role: string, keepId: string) {
  const { error } = await sb
    .from("client_contacts")
    .update({ is_primary: false })
    .eq("client_id", clientId)
    .eq("role", role)
    .neq("id", keepId);
  if (error) throw new Error(error.message);
}

export const addClientContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, contact: fieldsSchema }).parse(d))
  .handler(async ({ data, context }): Promise<ClientContact> => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId } = data;
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action: "edit" });
    const fields = cleanContactFields(data.contact);
    const { data: last } = await sb
      .from("client_contacts")
      .select("sort")
      .eq("client_id", clientId)
      .eq("role", fields.role)
      .order("sort", { ascending: false })
      .limit(1);
    const sort = ((last?.[0] as { sort?: number } | undefined)?.sort ?? -1) + 1;
    const { data: rows, error } = await sb
      .from("client_contacts")
      .insert({ ...fields, sort, organization_id: organizationId, client_id: clientId, created_by: userId })
      .select(CLIENT_CONTACT_COLUMNS);
    if (error) throw new Error(error.message);
    const row = assertRowsChanged(rows)[0] as unknown as ClientContact;
    if (row.is_primary) await clearOtherPrimary(sb, clientId, row.role, row.id);
    return row;
  });

export const updateClientContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ...scope, contactId: z.string().uuid(), contact: fieldsSchema }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ClientContact> => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId, contactId } = data;
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action: "edit" });
    const fields = cleanContactFields(data.contact);
    const { data: rows, error } = await sb
      .from("client_contacts")
      .update(fields)
      .eq("id", contactId)
      .eq("client_id", clientId)
      .eq("organization_id", organizationId)
      .select(CLIENT_CONTACT_COLUMNS);
    if (error) throw new Error(error.message);
    const row = assertRowsChanged(rows)[0] as unknown as ClientContact;
    if (row.is_primary) await clearOtherPrimary(sb, clientId, row.role, row.id);
    return row;
  });

/** End a contact (kept for the record; drops off every screen from today). */
export const endClientContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId, contactId } = data;
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action: "edit" });
    const { data: rows, error } = await sb
      .from("client_contacts")
      .update({ ended_on: todayYmd(), is_primary: false })
      .eq("id", contactId)
      .eq("client_id", clientId)
      .eq("organization_id", organizationId)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: contactId };
  });
