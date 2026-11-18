// Reads behind Settings › Homes, run with the caller's client after the access
// check in homes.functions.ts. Every query is scoped to the agency. Residents
// are the clients whose Home (clients.team_id) is this home and who haven't
// left; a home's team is the active team members assigned (staff_assignments)
// to any resident. organization_members and profiles are read separately and
// joined here (no FK between them).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DISCHARGED_STATUSES } from "@/lib/clients/list/list";
import { requireCategory } from "@/lib/access/require";
import { homeKind, type HomeKind } from "./home-kind";
import { homesAccess, type HomeListRow } from "./home-setup";
import type { NeedRow } from "./staffing-needs";

export type Sb = SupabaseClient<Database>;
type Person = { id: string; name: string };

const DISCHARGED_IN = `(${DISCHARGED_STATUSES.join(",")})`;

/** Throws unless the caller may see (min "view") or change (min "edit") homes. */
export async function requireHomes(sb: Sb, userId: string, orgId: string, min: "view" | "edit") {
  const access = await requireCategory(sb, userId, orgId, "scheduling", "view");
  const can = homesAccess({
    level: access.level,
    scope: access.scope,
    scheduling: access.categories.scheduling,
  });
  if (min === "view" ? !can.canView : !can.canEdit) {
    throw new Error(
      min === "view"
        ? "Only Owners and Admins with Scheduling access can see homes."
        : "Only the Owner or an agency-wide Admin with Scheduling: Edit can change homes.",
    );
  }
}

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

/** Clients living in the given homes (not discharged, not deleted). */
async function residentRows(sb: Sb, orgId: string, teamIds: string[]) {
  if (teamIds.length === 0) return [];
  return must(
    await sb
      .from("clients")
      .select("id, first_name, last_name, team_id")
      .eq("organization_id", orgId)
      .in("team_id", teamIds)
      .is("deleted_at", null)
      .or(`account_status.is.null,account_status.not.in.${DISCHARGED_IN}`)
      .order("last_name"),
  );
}

/** How many people live in one home now. */
export async function residentCount(sb: Sb, orgId: string, teamId: string): Promise<number> {
  return (await residentRows(sb, orgId, [teamId])).length;
}

/** Active team members of the agency, optionally only these ids, by name. */
export async function activePeople(sb: Sb, orgId: string, ids?: string[]): Promise<Person[]> {
  if (ids && ids.length === 0) return [];
  let q = sb
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("active", true)
    .is("deleted_at", null);
  if (ids) q = q.in("user_id", ids);
  const userIds = must(await q).map((m) => m.user_id);
  if (userIds.length === 0) return [];
  const profiles = must(await sb.from("profiles").select("id, full_name, email").in("id", userIds));
  return profiles
    .map((p) => ({ id: p.id, name: p.full_name || p.email || "Unnamed team member" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadHomeList(sb: Sb, orgId: string): Promise<HomeListRow[]> {
  const teams = must(
    await sb
      .from("teams")
      .select("id, team_name, team_type, manager_id, active, archived_at")
      .eq("organization_id", orgId),
  );
  const residents = await residentRows(
    sb,
    orgId,
    teams.map((t) => t.id),
  );
  const leads = await activePeople(sb, orgId, [
    ...new Set(teams.map((t) => t.manager_id).filter((x): x is string => !!x)),
  ]);
  const leadName = new Map(leads.map((p) => [p.id, p.name]));
  return teams.map((t) => ({
    id: t.id,
    name: t.team_name,
    kind: homeKind(t.team_type),
    leadName: t.manager_id ? (leadName.get(t.manager_id) ?? null) : null,
    residents: residents.filter((c) => c.team_id === t.id).length,
    active: t.active,
    archivedAt: t.archived_at,
  }));
}

export type HomeDetail = {
  home: {
    id: string;
    name: string;
    kind: HomeKind;
    leadId: string | null;
    address: string | null;
    capacity: number | null;
    active: boolean;
    archivedAt: string | null;
    archivedReason: string | null;
  };
  residents: { id: string; firstName: string; lastName: string }[];
  needs: NeedRow[];
  /** Active team members assigned to any resident. */
  team: Person[];
  /** Everyone who can be picked as the lead (active team members). */
  people: Person[];
};

export async function loadHomeDetail(
  sb: Sb,
  orgId: string,
  teamId: string,
): Promise<HomeDetail | null> {
  const { data: t, error } = await sb
    .from("teams")
    .select(
      "id, team_name, team_type, manager_id, address, capacity, active, archived_at, archived_reason",
    )
    .eq("organization_id", orgId)
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) return null;
  const [residents, needs, people] = await Promise.all([
    residentRows(sb, orgId, [teamId]),
    sb
      .from("location_coverage_requirements")
      .select("id, day_of_week, start_time, end_time, required_staff_count, awake_required, notes")
      .eq("organization_id", orgId)
      .eq("team_id", teamId)
      .then(must),
    activePeople(sb, orgId),
  ]);
  const assigned = residents.length
    ? must(
        await sb
          .from("staff_assignments")
          .select("staff_id")
          .eq("organization_id", orgId)
          .in(
            "client_id",
            residents.map((c) => c.id),
          ),
      )
    : [];
  const teamIds = new Set(assigned.map((a) => a.staff_id));
  return {
    home: {
      id: t.id,
      name: t.team_name,
      kind: homeKind(t.team_type),
      leadId: t.manager_id,
      address: t.address,
      capacity: t.capacity,
      active: t.active,
      archivedAt: t.archived_at,
      archivedReason: t.archived_reason,
    },
    residents: residents.map((c) => ({ id: c.id, firstName: c.first_name, lastName: c.last_name })),
    needs,
    team: people.filter((p) => teamIds.has(p.id)),
    people,
  };
}
