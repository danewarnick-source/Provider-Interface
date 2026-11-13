// Staffing needs on a home (Settings › Homes): save a time block (add, or edit
// by replacing the rows it stood for) and remove one. Rows live in
// location_coverage_requirements keyed by team_id, one per day
// (staffing-needs.ts). Host homes have none: hosts never clock. Same access as
// the rest of the home (requireHomes, edit).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRowsChanged } from "@/lib/clients/writes";
import { homeKind } from "./home-kind";
import { requireHomes, type Sb } from "./homes-load.server";
import { needDays, needProblems } from "./staffing-needs";

const uuid = z.string().uuid();
const home = { organizationId: uuid, teamId: uuid };

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

async function assertStaffedHome(sb: Sb, orgId: string, teamId: string) {
  const { data, error } = await sb
    .from("teams")
    .select("team_type")
    .eq("organization_id", orgId)
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That home wasn't found.");
  if (homeKind(data.team_type) === "host_home")
    throw new Error("Host homes have no staffing needs: hosts don't clock in.");
}

async function removeRows(sb: Sb, orgId: string, teamId: string, ids: string[]) {
  if (ids.length === 0) return;
  const { data, error } = await sb
    .from("location_coverage_requirements")
    .delete()
    .eq("organization_id", orgId)
    .eq("team_id", teamId)
    .in("id", ids)
    .select("id");
  if (error) throw new Error(error.message);
  assertRowsChanged(data);
}

/** Add a time block, or edit one: the new rows go in first, then the old ones come out. */
export const saveStaffingNeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ...home,
        replaceIds: z.array(uuid).max(14),
        block: z.object({
          days: z.array(z.number().int()),
          start: z.string(),
          end: z.string(),
          staff: z.number(),
          awake: z.boolean(),
          notes: z.string(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, teamId, block } = data;
    await requireHomes(sb, userId, organizationId, "edit");
    const problems = needProblems({ ...block, ids: data.replaceIds });
    if (problems.length) throw new Error(problems.join(" "));
    await assertStaffedHome(sb, organizationId, teamId);
    const rows = needDays(block.days).map((day) => ({
      organization_id: organizationId,
      team_id: teamId,
      day_of_week: day,
      start_time: block.start,
      end_time: block.end,
      required_staff_count: block.staff,
      awake_required: block.awake,
      notes: block.notes.trim() || null,
    }));
    const { data: added, error } = await sb
      .from("location_coverage_requirements")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(added);
    await removeRows(sb, organizationId, teamId, data.replaceIds);
    return { ids: (added ?? []).map((r) => r.id) };
  });

export const removeStaffingNeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...home, ids: z.array(uuid).min(1).max(14) }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await requireHomes(sb, userId, data.organizationId, "edit");
    await removeRows(sb, data.organizationId, data.teamId, data.ids);
    return { ids: data.ids };
  });
