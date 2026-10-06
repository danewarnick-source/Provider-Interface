// Server-side plan writes shared by the plan server functions, PCSP goal
// extraction and smart import. They take the caller's Supabase client;
// callers run assertCanManageClient (or an equivalent admin check) first.
// Nothing is deleted: replaced goals are ended, replaced plans become 'past'.

import { todayYmd } from "./dates.ts";
import { assertRowsChanged } from "./writes.ts";
import { normalizeCodes, planStatusOn, type PlanSource } from "./plans.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = { from: (table: string) => any };

/** Mark the client's current plan(s) 'past' so a new one can be current. */
async function retireCurrent(sb: Sb, clientId: string): Promise<void> {
  const { error } = await sb.from("client_plans").update({ status: "past" }).eq("client_id", clientId).eq("status", "current");
  if (error) throw new Error(error.message);
}

/** Create a plan (status from its dates; a new current plan retires the old one). Returns its id. */
export async function insertPlan(
  sb: Sb,
  a: { organizationId: string; clientId: string; userId?: string | null; source: PlanSource;
       start_date?: string | null; end_date?: string | null; activated_on?: string | null; meeting_date?: string | null },
): Promise<string> {
  const dates = { start_date: a.start_date ?? null, end_date: a.end_date ?? null };
  const status = planStatusOn({ ...dates, status: "current" }, todayYmd());
  if (status === "current") await retireCurrent(sb, a.clientId);
  const { data: rows, error } = await sb
    .from("client_plans")
    .insert({
      organization_id: a.organizationId, client_id: a.clientId, ...dates, status,
      activated_on: a.activated_on ?? null, meeting_date: a.meeting_date ?? null,
      source: a.source, created_by: a.userId ?? null,
    })
    .select("id");
  if (error) throw new Error(error.message);
  return (assertRowsChanged(rows as unknown[])[0] as { id: string }).id;
}

/** The current plan's id, creating an undated plan when the client has none. */
async function currentPlanId(sb: Sb, a: { organizationId: string; clientId: string; userId?: string | null; source: PlanSource }) {
  const { data, error } = await sb.from("client_plans").select("id").eq("client_id", a.clientId).eq("status", "current").maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? (await insertPlan(sb, a));
}

export interface ImportedGoal {
  goal_text: string;
  support_text: string;
  details: string | null;
  our_codes: string[];
}

async function addGoals(
  sb: Sb,
  a: { organizationId: string; clientId: string; userId?: string | null; planId: string; goals: ImportedGoal[] },
): Promise<number> {
  const { count } = await sb.from("client_goals").select("id", { count: "exact", head: true }).eq("plan_id", a.planId);
  let sort = count ?? 0;
  let added = 0;
  for (const g of a.goals) {
    const goal_text = g.goal_text.trim();
    if (!goal_text) continue;
    const { data: rows, error } = await sb
      .from("client_goals")
      .insert({ organization_id: a.organizationId, client_id: a.clientId, plan_id: a.planId, goal_text, sort: sort++, created_by: a.userId ?? null })
      .select("id");
    if (error) throw new Error(error.message);
    const goalId = (assertRowsChanged(rows as unknown[])[0] as { id: string }).id;
    const { error: sErr } = await sb.from("client_goal_supports").insert({
      organization_id: a.organizationId, goal_id: goalId, support_text: g.support_text.trim(),
      details: g.details?.trim() || null, our_codes: normalizeCodes(g.our_codes),
    });
    if (sErr) throw new Error(sErr.message);
    added++;
  }
  return added;
}

/**
 * Replace the current plan's goals with goals read from a PCSP: its active
 * goals are ended (kept), the new ones added with one support each.
 */
export async function replaceCurrentPlanGoals(
  sb: Sb,
  a: { organizationId: string; clientId: string; userId: string; goals: ImportedGoal[] },
): Promise<{ planId: string; goalCount: number }> {
  const planId = await currentPlanId(sb, { ...a, source: "pcsp_upload" });
  const { error } = await sb
    .from("client_goals").update({ status: "ended", ended_on: todayYmd() }).eq("plan_id", planId).eq("status", "active");
  if (error) throw new Error(error.message);
  return { planId, goalCount: await addGoals(sb, { ...a, planId }) };
}

/** Goal texts not already active on the plan (case/space-insensitive), first copy only. */
export function newGoalTexts(existing: readonly string[], incoming: readonly string[]): string[] {
  const key = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
  const seen = new Set(existing.map(key));
  const out: string[] = [];
  for (const t of incoming) {
    const k = key(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t.trim());
  }
  return out;
}

/**
 * Smart import: add goal texts the current plan doesn't have yet, each with
 * one blank support listing `codes`. Returns how many were added.
 */
export async function appendGoalsToCurrentPlan(
  sb: Sb,
  a: { organizationId: string; clientId: string; goals: string[]; codes: string[] },
): Promise<number> {
  const planId = await currentPlanId(sb, { ...a, source: "pcsp_upload" });
  const { data, error } = await sb.from("client_goals").select("goal_text").eq("plan_id", planId).eq("status", "active");
  if (error) throw new Error(error.message);
  const texts = newGoalTexts(((data ?? []) as Array<{ goal_text: string }>).map((g) => g.goal_text), a.goals);
  return addGoals(sb, {
    ...a,
    planId,
    goals: texts.map((goal_text) => ({ goal_text, support_text: "", details: null, our_codes: a.codes })),
  });
}
