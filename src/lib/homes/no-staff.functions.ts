// "No staff needed" at a home (B7): save a block (0-staff staffing-need rows
// with the reason, weekly or one date) and remove one. Called by the gap
// dialog (board, home page, Needs you) and the home page's No staff needed
// card. Needs Scheduling edit; writes run as the caller (RLS: admins and
// managers of the agency), so a write that matches nothing says so.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import { assertRowsChanged } from "@/lib/clients/writes";
import { homeKind } from "./home-kind";
import { noStaffProblem, noStaffRows } from "./no-staff";

type Sb = SupabaseClient<Database>;
const uuid = z.string().uuid();

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

export const saveNoStaffBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organizationId: uuid,
        teamId: uuid,
        draft: z.object({
          why: z.string().max(40),
          explanation: z.string().max(400),
          start: z.string(),
          end: z.string(),
          often: z.enum(["once", "weekly"]),
          date: z.string(),
          days: z.array(z.number().int().min(0).max(6)).max(7),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await requireCategory(sb, userId, data.organizationId, "scheduling", "edit");
    const problem = noStaffProblem(data.draft);
    if (problem) throw new Error(problem);
    await assertStaffedHome(sb, data.organizationId, data.teamId);
    const rows = noStaffRows(data.draft).map((r) => ({
      ...r,
      organization_id: data.organizationId,
      team_id: data.teamId,
    }));
    const { data: added, error } = await sb
      .from("location_coverage_requirements")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    return { ids: assertRowsChanged(added).map((r) => r.id) };
  });

export const removeNoStaffBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ organizationId: uuid, teamId: uuid, ids: z.array(uuid).min(1).max(14) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await requireCategory(sb, userId, data.organizationId, "scheduling", "edit");
    const { data: gone, error } = await sb
      .from("location_coverage_requirements")
      .delete()
      .eq("organization_id", data.organizationId)
      .eq("team_id", data.teamId)
      .eq("required_staff_count", 0)
      .in("id", data.ids)
      .select("id");
    if (error) throw new Error(error.message);
    return { ids: assertRowsChanged(gone).map((r) => r.id) };
  });
