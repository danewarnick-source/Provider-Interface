// Custom fields on clients (and team members). Every fn checks membership,
// category and scope itself: on AWS the server client can bypass RLS.
// Definitions are archived, never deleted, so saved values stay.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { assertCanManageClient } from "@/lib/clients/guards.server";
import { SECTION_NAMES } from "@/lib/clients/staff-visibility";
import {
  AGENCY_WIDE_FIELDS_MESSAGE,
  assertDefinitionWritable,
  categoryForFieldKind,
  chunkIds,
  type CustomFieldKind,
} from "@/lib/clients/custom-fields-archive";

const Kind = z.enum(["employee", "client"]);
const Section = z.enum(SECTION_NAMES as unknown as [string, ...string[]]);
const DataType = z.enum(["text", "number", "boolean", "date"]);

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Definitions are agency-wide, so changing them needs the kind's category at
 * Edit with whole-agency scope (the same bar as the definitions' RLS).
 */
async function requireAgencyFieldEditor(
  supabase: any,
  userId: string,
  organizationId: string,
  kind: CustomFieldKind,
) {
  const access = await requireCategory(supabase, userId, organizationId, categoryForFieldKind(kind), "edit");
  if (access.scope !== "agency") throw new Error(AGENCY_WIDE_FIELDS_MESSAGE);
}

/** Team member fields: Team roster: Edit, the person is in this agency and in the caller's scope. */
async function assertCanEditTeamMember(
  supabase: any,
  userId: string,
  organizationId: string,
  memberUserId: string,
) {
  const access = await requireCategory(supabase, userId, organizationId, "staff_roster", "edit");
  const { data: member, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", memberUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) throw new Error("Team member not found in this organization");
  if (access.scope !== "agency") {
    const { data: visible, error: vErr } = await supabase.rpc("access_can_see_staff", {
      _org: organizationId,
      _staff: memberUserId,
      _viewer: userId,
    });
    if (vErr) throw new Error(vErr.message);
    if (visible !== true) throw new Error("This team member isn't in your assigned homes or staff");
  }
}

export const setCustomFieldValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      definitionId: z.string().uuid(),
      entityKind: Kind,
      entityId: z.string().uuid(),
      value_text: z.string().nullable().optional(),
      value_number: z.number().nullable().optional(),
      value_boolean: z.boolean().nullable().optional(),
      value_date: z.string().nullable().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };

    if (data.entityKind === "client") {
      // Clients: Edit, the client is in this agency, in scope, not deleted or discharged.
      await assertCanManageClient({
        supabase,
        actorId: userId,
        organizationId: data.organizationId,
        clientId: data.entityId,
        action: "edit",
      });
    } else {
      await assertCanEditTeamMember(supabase, userId, data.organizationId, data.entityId);
    }

    // The definition must be this agency's, of this kind, and not archived.
    const { data: def, error: defErr } = await (supabase as any)
      .from("custom_field_definitions")
      .select("id, entity_kind, archived_at")
      .eq("id", data.definitionId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (defErr) throw new Error(defErr.message);
    assertDefinitionWritable(def, data.entityKind);

    const { error } = await (supabase as any).from("custom_field_values").upsert({
      organization_id: data.organizationId,
      definition_id: data.definitionId,
      entity_kind: data.entityKind,
      entity_id: data.entityId,
      value_text: data.value_text ?? null,
      value_number: data.value_number ?? null,
      value_boolean: data.value_boolean ?? null,
      value_date: data.value_date ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "definition_id,entity_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Create a new custom field definition, pinned to one of the six client
 * profile sections. The section drives staff visibility (via the parent
 * section's toggle) — there's no separate per-field switch.
 *
 * `field_key` is derived from the label so a human-readable slug shows up
 * in exports/API responses. Collisions (archived fields included) bump `_2`, `_3`, etc.
 */
export const createCustomFieldDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      entityKind: Kind,
      section: Section,
      field_label: z.string().min(1).max(120),
      data_type: DataType,
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { id: "" };
    await requireAgencyFieldEditor(supabase, userId, data.organizationId, data.entityKind);

    const baseKey = data.field_label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "custom_field";

    // Find a unique key within the org+entityKind scope.
    let key = baseKey;
    for (let i = 2; i < 100; i++) {
      const { data: existing } = await (supabase as any)
        .from("custom_field_definitions")
        .select("id")
        .eq("organization_id", data.organizationId)
        .eq("entity_kind", data.entityKind)
        .eq("field_key", key)
        .maybeSingle();
      if (!existing) break;
      key = `${baseKey}_${i}`;
    }

    const { data: inserted, error } = await (supabase as any)
      .from("custom_field_definitions")
      .insert({
        organization_id: data.organizationId,
        entity_kind: data.entityKind,
        field_key: key,
        field_label: data.field_label,
        data_type: data.data_type,
        section: data.section,
        source: "manual",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted!.id as string };
  });

/**
 * Archive definitions of one kind (nothing is deleted; values stay). Already
 * archived ones are left as they are.
 */
export const archiveCustomFieldDefinitions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      entityKind: Kind,
      definitionIds: z.array(z.string().uuid()).min(1).max(200),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false, archived: 0 };
    await requireAgencyFieldEditor(supabase, userId, data.organizationId, data.entityKind);
    const now = new Date().toISOString();
    let archived = 0;
    for (const chunk of chunkIds(data.definitionIds)) {
      const { data: rows, error } = await (supabase as any)
        .from("custom_field_definitions")
        .update({ archived_at: now, archived_by: userId })
        .eq("organization_id", data.organizationId)
        .eq("entity_kind", data.entityKind)
        .is("archived_at", null)
        .in("id", chunk)
        .select("id");
      if (error) throw new Error(error.message);
      archived += Array.isArray(rows) ? rows.length : 0;
    }
    return { ok: true, archived };
  });

/** Bring an archived definition back; it takes values again. */
export const restoreCustomFieldDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      entityKind: Kind,
      definitionId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) return { ok: false };
    await requireAgencyFieldEditor(supabase, userId, data.organizationId, data.entityKind);
    const { data: rows, error } = await (supabase as any)
      .from("custom_field_definitions")
      .update({ archived_at: null, archived_by: null })
      .eq("organization_id", data.organizationId)
      .eq("entity_kind", data.entityKind)
      .eq("id", data.definitionId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("Field not found in this organization");
    return { ok: true };
  });
