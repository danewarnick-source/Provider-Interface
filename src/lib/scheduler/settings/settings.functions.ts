// Loads everything the Scheduling settings screen shows (Settings › all tabs)
// and the "Settings for <home>" card. The Owner edits; agency-wide Admins see
// it read-only (canEdit false); nobody else may open it. Saves are in
// settings-save.functions.ts. Owner tables: see settings-model.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { isAgencyAdmin, isOwner } from "@/lib/access/levels";
import { loadNewHires } from "@/lib/scheduler/settings/new-hires.server";
import type {
  AgencyHoliday,
  AgencySchedulingSettings,
  ShiftType,
  TeamScheduleSettings,
} from "@/lib/scheduler/settings/settings-model";

export type SettingsHome = { id: string; name: string; kind: string; managerId: string | null };
export type SettingsPerson = { id: string; name: string };

const NOT_ALLOWED = "Only the owner and agency-wide admins can open Scheduling settings.";

export const loadSchedulingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) =>
    z.object({ organizationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Sign in again to open Scheduling settings.");
    const orgId = data.organizationId;
    const access = await requireOrgMembership(supabase, userId, orgId, "admin").catch(() => {
      throw new Error(NOT_ALLOWED);
    });
    if (!isOwner(access.level) && !isAgencyAdmin(access.level, access.scope))
      throw new Error(NOT_ALLOWED);

    const [agency, teams, homeSettings, types, holidays, members] = await Promise.all([
      supabase
        .from("org_shift_behavior_settings")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase
        .from("teams")
        .select("id, team_name, team_type, manager_id")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("team_name"),
      supabase.from("team_schedule_settings").select("*").eq("organization_id", orgId),
      supabase
        .from("shift_types")
        .select("*")
        .eq("organization_id", orgId)
        .is("archived_at", null)
        .order("created_at"),
      supabase
        .from("agency_holidays")
        .select("*")
        .eq("organization_id", orgId)
        .order("holiday_date"),
      supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("active", true),
    ]);
    for (const r of [agency, teams, homeSettings, types, holidays, members])
      if (r.error) throw new Error(r.error.message);
    if (!agency.data)
      throw new Error(
        "This agency has no scheduling settings yet. Reload the page; if it stays empty, contact HIVE support.",
      );

    // Names: two queries, never an organization_members↔profiles embed.
    const ids = (members.data ?? []).map((m) => m.user_id);
    const { data: profiles, error: pErr } = ids.length
      ? await supabase.from("profiles").select("id, full_name, first_name, last_name").in("id", ids)
      : { data: [], error: null };
    if (pErr) throw new Error(pErr.message);
    const people: SettingsPerson[] = (profiles ?? [])
      .map((p) => ({
        id: p.id,
        name:
          (p.full_name ?? "").trim() ||
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          "Team member",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Team member";

    const homes: SettingsHome[] = (teams.data ?? []).map((t) => ({
      id: t.id,
      name: t.team_name,
      kind: t.team_type,
      managerId: t.manager_id,
    }));
    const newHires = await loadNewHires(
      supabase,
      orgId,
      homes.filter((h) => h.kind !== "other").map((h) => h.id),
      nameOf,
    );

    return {
      canEdit: isOwner(access.level),
      agency: agency.data as AgencySchedulingSettings,
      homes,
      homeSettings: (homeSettings.data ?? []) as TeamScheduleSettings[],
      shiftTypes: (types.data ?? []) as ShiftType[],
      holidays: (holidays.data ?? []) as AgencyHoliday[],
      people,
      newHires,
    };
  });

export type SchedulingSettingsData = Awaited<ReturnType<typeof loadSchedulingSettings>>;
