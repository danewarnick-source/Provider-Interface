// Server fns for Access & presets: preset CRUD, a member's level/preset/scope/overrides,
// assignments, and the change log. Only Owners (or HIVE executives) write.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { reevaluateStaffDutiesInternal } from "@/lib/staff-assignment-hooks.functions";
import { logChange, nameOf } from "./change-log.server";
import { asCategoryMap, diffOverrides } from "./can";
import { CATEGORY_IDS, type CategoryId, type CategoryMap, type CategoryValue } from "./categories";
import type { AccessLevel, AccessScope, AssignmentKind } from "./levels";
import type { Json } from "@/integrations/supabase/types";

// ---------- shared ----------

const Uuid = z.string().uuid();
const Level = z.enum(["owner", "admin", "staff"]);
const PresetLevel = z.enum(["admin", "staff"]);
const Scope = z.enum(["agency", "assigned", "self"]);
const Value = z.enum(["off", "view", "edit"]);
const Categories = z.record(z.enum(CATEGORY_IDS as unknown as [CategoryId, ...CategoryId[]]), Value);
const Assignment = z.object({ kind: z.enum(["home", "staff", "client"]), target_id: Uuid });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

async function requireAccessManager(supabase: Sb, userId: string, orgId: string): Promise<{ isHiveExec: boolean }> {
  const { data: isHiveExec } = await supabase.rpc("is_hive_executive", { _user: userId });
  if (!isHiveExec) await requireOrgMembership(supabase, userId, orgId, "owner");
  return { isHiveExec: !!isHiveExec };
}

/** Staff presets/overrides may add read-only views; only the phone app is "edit". */
function clampForLevel(level: AccessLevel, cats: CategoryMap): CategoryMap {
  const out: CategoryMap = {};
  for (const [id, v] of Object.entries(cats) as [CategoryId, CategoryValue][]) {
    if (id === "agency_settings") continue;
    out[id] = level === "staff" && id !== "phone_app" && v === "edit" ? "view" : v;
  }
  return out;
}

// ---------- presets ----------

export interface AccessPreset {
  id: string;
  name: string;
  access_level: Exclude<AccessLevel, "owner">;
  access_scope: AccessScope;
  home_page: string | null;
  categories: CategoryMap;
  seed_key: string | null;
  member_count: number;
}

export const listAccessPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ organization_id: Uuid }).parse(d))
  .handler(async ({ data, context }): Promise<AccessPreset[]> => {
    await requireOrgMembership(context.supabase, context.userId, data.organization_id);
    const [{ data: presets, error }, { data: members }] = await Promise.all([
      context.supabase
        .from("access_presets")
        .select("id, name, access_level, access_scope, home_page, categories, seed_key")
        .eq("organization_id", data.organization_id)
        .order("access_level")
        .order("name"),
      context.supabase
        .from("organization_members")
        .select("access_preset_id")
        .eq("organization_id", data.organization_id)
        .eq("active", true),
    ]);
    if (error) throw error;
    const counts = new Map<string, number>();
    (members ?? []).forEach((m: { access_preset_id: string | null }) => {
      if (m.access_preset_id) counts.set(m.access_preset_id, (counts.get(m.access_preset_id) ?? 0) + 1);
    });
    return (presets ?? []).map((p: Record<string, unknown>) => ({
      ...(p as unknown as AccessPreset),
      categories: asCategoryMap(p.categories),
      member_count: counts.get(p.id as string) ?? 0,
    }));
  });

export const saveAccessPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        organization_id: Uuid,
        id: Uuid.nullable(),
        name: z.string().trim().min(1).max(80),
        access_level: PresetLevel,
        access_scope: Scope,
        home_page: z.string().trim().max(200).nullable(),
        categories: Categories,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAccessManager(context.supabase, context.userId, data.organization_id);
    const row = {
      organization_id: data.organization_id,
      name: data.name,
      access_level: data.access_level,
      access_scope: data.access_scope,
      home_page: data.home_page || null,
      categories: clampForLevel(data.access_level, data.categories),
    };
    const q = data.id
      ? supabaseAdmin.from("access_presets").update(row).eq("id", data.id).eq("organization_id", data.organization_id)
      : supabaseAdmin.from("access_presets").insert(row);
    const { data: saved, error } = await q.select("id").single();
    if (error) throw new Error(error.code === "23505" ? "A preset with that name already exists" : error.message);
    await logChange(data.organization_id, context.userId, data.id ? "preset_updated" : "preset_created", {}, {
      preset_id: saved.id,
      ...row,
    });
    return { id: saved.id as string };
  });

export const deleteAccessPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ organization_id: Uuid, id: Uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAccessManager(context.supabase, context.userId, data.organization_id);
    const { count } = await supabaseAdmin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("access_preset_id", data.id)
      .eq("active", true);
    if (count) throw new Error(`Move the ${count} people using this preset to another preset first`);
    const { data: gone, error } = await supabaseAdmin
      .from("access_presets")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .select("name")
      .maybeSingle();
    if (error) throw error;
    await logChange(data.organization_id, context.userId, "preset_deleted", {}, { preset_id: data.id, name: gone?.name });
    return { ok: true };
  });

// ---------- one member ----------

export interface MemberAccessDetail {
  membership_id: string;
  access_level: AccessLevel;
  access_scope: AccessScope;
  access_preset_id: string | null;
  access_overrides: CategoryMap;
  assignments: Array<{ kind: AssignmentKind; target_id: string }>;
}

export const getMemberAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ organization_id: Uuid, user_id: Uuid }).parse(d))
  .handler(async ({ data, context }): Promise<MemberAccessDetail | null> => {
    await requireOrgMembership(context.supabase, context.userId, data.organization_id, "admin");
    const [{ data: m }, { data: rows }] = await Promise.all([
      context.supabase
        .from("organization_members")
        .select("id, access_level, access_scope, access_preset_id, access_overrides")
        .eq("organization_id", data.organization_id)
        .eq("user_id", data.user_id)
        .maybeSingle(),
      context.supabase
        .from("access_assignments")
        .select("kind, target_id")
        .eq("organization_id", data.organization_id)
        .eq("user_id", data.user_id),
    ]);
    if (!m) return null;
    return {
      membership_id: m.id,
      access_level: m.access_level,
      access_scope: m.access_scope as AccessScope,
      access_preset_id: m.access_preset_id,
      access_overrides: asCategoryMap(m.access_overrides),
      assignments: (rows ?? []) as Array<{ kind: AssignmentKind; target_id: string }>,
    };
  });

export const setMemberAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        organization_id: Uuid,
        user_id: Uuid,
        access_level: Level,
        access_preset_id: Uuid.nullable(),
        access_scope: Scope,
        /** Full wanted map; only differences from the preset are stored. */
        categories: Categories,
        assignments: z.array(Assignment).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAccessManager(context.supabase, context.userId, data.organization_id);
    const orgId = data.organization_id;
    const owner = data.access_level === "owner";

    let presetCats: unknown = {};
    if (!owner) {
      const { data: preset } = await supabaseAdmin
        .from("access_presets")
        .select("access_level, categories")
        .eq("id", data.access_preset_id ?? "")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!preset) throw new Error("Pick a preset for Admin and Team member access");
      if (preset.access_level !== data.access_level) throw new Error("That preset is for a different access level");
      presetCats = preset.categories;
    }

    const { data: before } = await supabaseAdmin
      .from("organization_members")
      .select("id, access_level, access_scope, access_preset_id, access_overrides")
      .eq("organization_id", orgId)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!before) throw new Error("Not a member of this organization");

    const after = {
      access_level: data.access_level,
      access_preset_id: owner ? null : data.access_preset_id,
      access_scope: owner ? "agency" : data.access_scope,
      access_overrides: owner ? {} : diffOverrides(presetCats, clampForLevel(data.access_level, data.categories)),
    };
    const { error } = await supabaseAdmin.from("organization_members").update(after).eq("id", before.id);
    if (error) throw new Error(error.message.includes("last active Owner") ? "An agency must keep at least one Owner" : error.message);

    const assignments = after.access_scope === "assigned" ? data.assignments : [];
    await supabaseAdmin.from("access_assignments").delete().eq("organization_id", orgId).eq("user_id", data.user_id);
    if (assignments.length) {
      const { error: e2 } = await supabaseAdmin
        .from("access_assignments")
        .insert(assignments.map((a) => ({ organization_id: orgId, user_id: data.user_id, ...a })));
      if (e2) throw e2;
    }

    await logChange(orgId, context.userId, "member_access", { userId: data.user_id }, {
      before: { ...before, id: undefined },
      after: { ...after, assignments: assignments.length },
    });
    if (before.access_level !== after.access_level) {
      try {
        await reevaluateStaffDutiesInternal(context.supabase, orgId, data.user_id);
      } catch (e) {
        console.warn("[obligations] access-change reevaluate failed:", e);
      }
    }
    return { ok: true };
  });

/** Pick lists for assignments: homes (teams), staff, clients. */
export const listAccessTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ organization_id: Uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAccessManager(context.supabase, context.userId, data.organization_id);
    const orgId = data.organization_id;
    const [{ data: teams }, { data: members }, { data: clients }] = await Promise.all([
      supabaseAdmin.from("teams").select("id, team_name").eq("organization_id", orgId).order("team_name"),
      supabaseAdmin.from("organization_members").select("user_id").eq("organization_id", orgId).eq("active", true),
      supabaseAdmin
        .from("clients")
        .select("id, first_name, last_name")
        .eq("organization_id", orgId)
        .order("last_name")
        .limit(2000),
    ]);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: people } = ids.length
      ? await supabaseAdmin.from("org_member_directory").select("id, full_name").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    return {
      home: (teams ?? []).map((t) => ({ id: t.id, label: t.team_name ?? "Unnamed home" })),
      staff: (people ?? [])
        .map((p) => ({ id: p.id as string, label: p.full_name ?? "Unknown" }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      client: (clients ?? []).map((c) => ({ id: c.id, label: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() })),
    } satisfies Record<AssignmentKind, Array<{ id: string; label: string }>>;
  });

// ---------- team list, executive grants, invitations ----------

export interface TeamMemberAccess {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  access_level: AccessLevel;
  access_scope: AccessScope;
  preset_name: string | null;
  company_executive: boolean;
  hive_executive: boolean;
}

export const listTeamAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ organization_id: Uuid }).parse(d))
  .handler(async ({ data, context }): Promise<TeamMemberAccess[]> => {
    await requireAccessManager(context.supabase, context.userId, data.organization_id);
    const { data: members, error } = await supabaseAdmin
      .from("organization_members")
      .select("id, user_id, access_level, access_scope, is_company_executive, access_presets(name)")
      .eq("organization_id", data.organization_id)
      .eq("active", true);
    if (error) throw error;
    const ids = (members ?? []).map((m) => m.user_id);
    if (!ids.length) return [];
    const [{ data: profiles }, { data: execs }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ids),
      supabaseAdmin.from("hive_executives").select("user_id").eq("active", true).in("user_id", ids),
    ]);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const hive = new Set((execs ?? []).map((h) => h.user_id));
    const rank = { owner: 0, admin: 1, staff: 2 } as const;
    return (members ?? [])
      .map((m) => ({
        membership_id: m.id,
        user_id: m.user_id,
        email: byId.get(m.user_id)?.email ?? "",
        full_name: byId.get(m.user_id)?.full_name ?? null,
        access_level: m.access_level as AccessLevel,
        access_scope: m.access_scope as AccessScope,
        preset_name: (m.access_presets as { name: string } | null)?.name ?? null,
        company_executive: !!m.is_company_executive,
        hive_executive: hive.has(m.user_id),
      }))
      .sort((a, b) => rank[a.access_level] - rank[b.access_level] || (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));
  });

export const setExecutiveGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        organization_id: Uuid,
        membership_id: Uuid,
        target_user_id: Uuid,
        company_executive: z.boolean(),
        hive_executive: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { isHiveExec } = await requireAccessManager(context.supabase, context.userId, data.organization_id);
    const { error } = await context.supabase.rpc("set_company_executive", {
      _membership_id: data.membership_id,
      _grant: data.company_executive,
    });
    if (error) throw error;
    if (isHiveExec) {
      const { error: e2 } = await context.supabase.rpc("set_hive_executive", {
        _user_id: data.target_user_id,
        _grant: data.hive_executive,
      });
      if (e2) throw e2;
    }
    await logChange(data.organization_id, context.userId, "executive_grants", { userId: data.target_user_id }, {
      company_executive: data.company_executive,
      hive_executive: isHiveExec ? data.hive_executive : undefined,
    });
    return { ok: true };
  });

/** A blocked member asks the agency's Owners for access (from /unauthorized). */
export const requestAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        organization_id: Uuid,
        needed: z.string().trim().min(1).max(120),
        reason: z.string().trim().min(1).max(1000),
        page: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireOrgMembership(context.supabase, context.userId, data.organization_id);
    const who = (await nameOf(context.userId)) ?? "A team member";
    const { error } = await context.supabase.from("notifications").insert({
      organization_id: data.organization_id,
      recipient_role: "owner",
      type: "permission_requested",
      urgency: "normal",
      title: `${who} is requesting access`,
      body: `${who} needs "${data.needed}".${data.page ? ` They were blocked on ${data.page}.` : ""} Reason: ${data.reason}`,
      link_to: `/dashboard/employees/${context.userId}#access`,
      related_id: context.userId,
      related_type: "permission_request",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- change log ----------

export interface AccessChangeRow {
  id: string;
  created_at: string;
  change_type: string;
  changed_by_name: string | null;
  target_user_name: string | null;
  details: Json;
  /** Legacy rows copied from the old role-change and permission logs. */
  legacy: string | null;
}

const PAGE_SIZE = 50;

export const listAccessChangeLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ organization_id: Uuid, page: z.number().int().min(0).default(0) }).parse(d))
  .handler(async ({ data, context }): Promise<{ rows: AccessChangeRow[]; hasMore: boolean }> => {
    await requireAccessManager(context.supabase, context.userId, data.organization_id);
    const from = data.page * PAGE_SIZE;
    const { data: rows, error } = await supabaseAdmin
      .from("access_change_log")
      .select("id, created_at, change_type, changed_by_name, target_user_name, details, role, permission, new_value")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const out = (rows ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      change_type: r.change_type,
      changed_by_name: r.changed_by_name,
      target_user_name: r.target_user_name,
      details: r.details ?? {},
      legacy: r.permission
        ? `${r.permission} ${r.new_value ? "on" : "off"}${r.role ? ` (${r.role})` : ""}`
        : r.role
          ? r.role
          : null,
    }));
    return { rows: out, hasMore: out.length === PAGE_SIZE };
  });
