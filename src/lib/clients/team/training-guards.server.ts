// Shared checks for the client-specific training server functions: the
// caller's membership, admin-only access, the client being in the agency, and
// the client's current plan goals.
import { isAdminLevel } from "@/lib/access/levels";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { assertCanManageClient } from "../guards.server";
import { todayYmd } from "../dates";
import { activeGoalViewsOn, type GoalView } from "../plans/plans";
import { loadPlanBundle } from "../plans/plans-load";

/** Active goals (with supports) of the client's plan in effect today. */
export async function planGoals(supabase: AnySupabase, clientId: string): Promise<GoalView[]> {
  return activeGoalViewsOn(await loadPlanBundle(supabase, clientId), todayYmd());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabase = any;

export function adminGuard(role: string | undefined) {
  if (!role || !isAdminLevel(role)) {
    throw new Error("Forbidden: admin access required.");
  }
}

/**
 * The caller's membership in the agency the request names (never "whichever
 * agency comes first": a person can belong to more than one).
 */
export async function getMembership(supabase: AnySupabase, userId: string, organizationId: string) {
  const access = await requireOrgMembership(supabase, userId, organizationId);
  return { organization_id: organizationId, access_level: access.level as string, access };
}

/** assertCanManageClient (category, scope, discharged) for this client in this agency. */
export async function guardClient(
  supabase: AnySupabase,
  userId: string,
  organizationId: string,
  clientId: string,
  action: "view" | "edit",
) {
  await assertCanManageClient({ supabase, actorId: userId, organizationId, clientId, action });
}

/** A training row by id, in the requested agency; returns its client. */
export async function trainingInOrg(supabase: AnySupabase, id: string, organizationId: string, columns: string) {
  const { data: row, error } = await supabase
    .from("client_specific_trainings")
    .select(`organization_id, client_id, ${columns}`)
    .eq("id", id)
    .maybeSingle();
  if (error || !row) throw new Error("Training not found.");
  if (row.organization_id !== organizationId) throw new Error("Forbidden.");
  return row;
}

export async function assertClientInOrg(supabase: AnySupabase, clientId: string, orgId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, organization_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) throw new Error("Client not found.");
  if (data.organization_id !== orgId) throw new Error("Forbidden: client belongs to another org.");
}
