// Settings › Homes server functions: the list, one home, Add home, save its
// details (name, kind, lead, address, licensed capacity), Archive and Restore.
// Homes are archived with a reason (teams.active = false, archived_at,
// archived_reason), never deleted, and a home can't be archived while anyone
// lives there. All run with the caller's client after requireHomes
// (home-setup.ts homesAccess). Staffing needs are in staffing-needs.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRowsChanged } from "@/lib/clients/writes";
import { HOME_KINDS, type HomeKind } from "./home-kind";
import {
  archiveBlockedReason,
  archiveReason,
  cleanHomePatch,
  homePatchProblems,
} from "./home-setup";
import {
  activePeople,
  loadHomeDetail,
  loadHomeList,
  requireHomes,
  residentCount,
  type Sb,
} from "./homes-load.server";

const uuid = z.string().uuid();
const kind = z.enum(HOME_KINDS.map((k) => k.value) as [HomeKind, ...HomeKind[]]);
const org = { organizationId: uuid };
const home = { ...org, teamId: uuid };

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

function problems(list: string[]) {
  if (list.length) throw new Error(list.join(" "));
}

export const getHomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object(org).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await requireHomes(sb, userId, data.organizationId, "view");
    return loadHomeList(sb, data.organizationId);
  });

export const getHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object(home).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await requireHomes(sb, userId, data.organizationId, "view");
    return loadHomeDetail(sb, data.organizationId, data.teamId);
  });

export const createHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...org, name: z.string(), kind }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await requireHomes(sb, userId, data.organizationId, "edit");
    const patch = cleanHomePatch({ team_name: data.name, team_type: data.kind });
    problems(homePatchProblems(patch));
    const { data: rows, error } = await sb
      .from("teams")
      .insert({
        organization_id: data.organizationId,
        team_name: patch.team_name!,
        team_type: data.kind,
      })
      .select("id");
    if (error) throw new Error(error.message);
    return { id: assertRowsChanged(rows)[0].id };
  });

export const saveHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ...home,
        patch: z
          .object({
            team_name: z.string(),
            team_type: kind,
            manager_id: uuid.nullable(),
            address: z.string().nullable(),
            capacity: z.number().nullable(),
          })
          .partial(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, teamId } = data;
    await requireHomes(sb, userId, organizationId, "edit");
    const patch = cleanHomePatch(data.patch);
    problems(homePatchProblems(patch));
    if (patch.manager_id) {
      const found = await activePeople(sb, organizationId, [patch.manager_id]);
      if (!found.length) throw new Error("Pick an active team member.");
    }
    const { data: rows, error } = await sb
      .from("teams")
      .update(patch)
      .eq("organization_id", organizationId)
      .eq("id", teamId)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: teamId };
  });

export const archiveHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...home, reason: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, teamId } = data;
    await requireHomes(sb, userId, organizationId, "edit");
    const reason = archiveReason(data.reason);
    if (!reason.ok) throw new Error(reason.error);
    const count = await residentCount(sb, organizationId, teamId);
    const blocked = archiveBlockedReason(count);
    if (blocked) {
      throw new Error(
        `${blocked}: ${count} client${count === 1 ? "" : "s"} still live${count === 1 ? "s" : ""} here. Change their Home in Clients.`,
      );
    }
    const { data: rows, error } = await sb
      .from("teams")
      .update({
        active: false,
        archived_at: new Date().toISOString(),
        archived_reason: reason.value,
      })
      .eq("organization_id", organizationId)
      .eq("id", teamId)
      .eq("active", true)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: teamId };
  });

export const restoreHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object(home).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, teamId } = data;
    await requireHomes(sb, userId, organizationId, "edit");
    const { data: rows, error } = await sb
      .from("teams")
      .update({ active: true, archived_at: null, archived_reason: null })
      .eq("organization_id", organizationId)
      .eq("id", teamId)
      .eq("active", false)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: teamId };
  });
