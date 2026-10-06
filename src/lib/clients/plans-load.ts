// Loads clients' plan years, goals and supports with the caller's Supabase
// client (RLS decides what they may see). Shared by every reader: punch pad
// care data, host-home daily logs, Nectar, progress summaries, training.

import { nestGoals, type ClientGoal, type ClientPlan, type ClientPlanBundle } from "./plans.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TableSupabase = { from: (table: string) => any };

export const PLAN_COLUMNS =
  "id, client_id, start_date, end_date, activated_on, meeting_date, status, label, source, document_id, created_at";
export const GOAL_COLUMNS =
  "id, client_id, plan_id, carried_from_goal_id, goal_text, domain, current_status, strengths, barriers, success_person, success_team, sort, status, ended_on";
export const SUPPORT_COLUMNS =
  "id, goal_id, support_text, details, start_date, end_date, our_codes, other_providers, health_needs, sort";

/** client_id → that client's plans and goals. Every requested client is in the map. */
export async function loadPlanBundles(
  supabase: TableSupabase,
  clientIds: readonly string[],
): Promise<Map<string, ClientPlanBundle>> {
  const ids = [...new Set(clientIds)].filter(Boolean);
  const out = new Map<string, ClientPlanBundle>();
  for (const id of ids) out.set(id, { plans: [], goals: [] });
  if (ids.length === 0) return out;

  const [plansRes, goalsRes] = await Promise.all([
    supabase.from("client_plans").select(PLAN_COLUMNS).in("client_id", ids),
    supabase.from("client_goals").select(GOAL_COLUMNS).in("client_id", ids),
  ]);
  if (plansRes.error) throw new Error(plansRes.error.message);
  if (goalsRes.error) throw new Error(goalsRes.error.message);
  const goalRows = (goalsRes.data ?? []) as Array<Omit<ClientGoal, "supports">>;

  let supportRows: unknown[] = [];
  if (goalRows.length) {
    const res = await supabase
      .from("client_goal_supports")
      .select(SUPPORT_COLUMNS)
      .in("goal_id", goalRows.map((g) => g.id));
    if (res.error) throw new Error(res.error.message);
    supportRows = res.data ?? [];
  }

  for (const p of (plansRes.data ?? []) as ClientPlan[]) out.get(p.client_id)?.plans.push(p);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const g of nestGoals(goalRows, supportRows as any)) out.get(g.client_id)?.goals.push(g);
  return out;
}

/** One client's plans and goals. */
export async function loadPlanBundle(supabase: TableSupabase, clientId: string): Promise<ClientPlanBundle> {
  return (await loadPlanBundles(supabase, [clientId])).get(clientId) ?? { plans: [], goals: [] };
}
