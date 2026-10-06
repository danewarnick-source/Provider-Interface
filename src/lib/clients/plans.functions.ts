// Plan years, goals and supports: read and write. Every call runs
// assertCanManageClient first, then uses the caller's own (RLS-scoped)
// Supabase client and confirms a row really changed. Nothing is deleted:
// goals are ended (status/ended_on), supports get an end_date, and a plan
// replaced by a newer current plan becomes 'past'.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCanManageClient } from "./guards.server";
import { assertRowsChanged } from "./writes";
import { todayYmd } from "./dates";
import { normalizeCodes } from "./plans";
import { insertPlan } from "./plans-write";
import { GOAL_COLUMNS, SUPPORT_COLUMNS } from "./plans-load";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

function ctx(context: { supabase?: unknown; userId?: string | null }): { sb: Sb; userId: string } {
  if (!context.supabase || !context.userId) throw new Error("Not signed in.");
  return { sb: context.supabase as Sb, userId: context.userId };
}

const scope = { organizationId: z.string().uuid(), clientId: z.string().uuid() };
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish();
const text = z.string().max(4000).nullish();
const clean = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

const planFields = { start_date: ymd, end_date: ymd, activated_on: ymd, meeting_date: ymd };

export const addClientPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, ...planFields }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({ supabase: sb, actorId: userId, ...data, action: "edit" });
    return { id: await insertPlan(sb, { ...data, userId, source: "manual" }) };
  });

const goalFields = z.object({
  goal_text: z.string().trim().min(1).max(4000),
  domain: text,
  current_status: text,
  strengths: text,
  barriers: text,
  success_person: text,
  success_team: text,
});

/**
 * Add a goal to a plan (goalId omitted) or edit one. `supportCodes` on an add
 * also creates one blank support listing those codes.
 */
export const saveClientGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      ...scope, planId: z.string().uuid(), goalId: z.string().uuid().nullish(), goal: goalFields,
      supportCodes: z.array(z.string().max(20)).max(30).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId, planId, goalId } = data;
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action: "edit" });
    const g = data.goal;
    const fields = {
      goal_text: g.goal_text.trim(), domain: clean(g.domain), current_status: clean(g.current_status),
      strengths: clean(g.strengths), barriers: clean(g.barriers),
      success_person: clean(g.success_person), success_team: clean(g.success_team),
    };
    if (goalId) {
      const { data: rows, error } = await sb
        .from("client_goals").update(fields).eq("id", goalId).eq("client_id", clientId).select(GOAL_COLUMNS);
      if (error) throw new Error(error.message);
      return assertRowsChanged(rows)[0];
    }
    const { count } = await sb.from("client_goals").select("id", { count: "exact", head: true }).eq("plan_id", planId);
    const { data: rows, error } = await sb
      .from("client_goals")
      .insert({ ...fields, organization_id: organizationId, client_id: clientId, plan_id: planId, sort: count ?? 0, created_by: userId })
      .select(GOAL_COLUMNS);
    if (error) throw new Error(error.message);
    const row = assertRowsChanged(rows)[0] as { id: string };
    if (data.supportCodes) {
      const { error: sErr } = await sb.from("client_goal_supports").insert({
        organization_id: organizationId, goal_id: row.id, support_text: "", our_codes: normalizeCodes(data.supportCodes),
      });
      if (sErr) throw new Error(sErr.message);
    }
    return row;
  });

/** End a goal (kept for history; staff stop seeing it). */
export const endClientGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, goalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({ supabase: sb, actorId: userId, ...data, action: "edit" });
    const { data: rows, error } = await sb
      .from("client_goals")
      .update({ status: "ended", ended_on: todayYmd() })
      .eq("id", data.goalId)
      .eq("client_id", data.clientId)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: data.goalId };
  });

const supportFields = z.object({
  support_text: z.string().max(4000),
  details: text,
  start_date: ymd,
  end_date: ymd,
  our_codes: z.array(z.string().max(20)).max(30),
  other_providers: z.array(z.object({ code: z.string().max(20), provider: z.string().max(200) })).max(30).optional(),
  health_needs: z.array(z.string().max(500)).max(30).optional(),
});

/** Add a support under a goal (supportId omitted) or edit one. */
export const saveGoalSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ...scope, goalId: z.string().uuid(), supportId: z.string().uuid().nullish(), support: supportFields }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    const { organizationId, clientId, goalId, supportId } = data;
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId, clientId, action: "edit" });
    const { data: goal } = await sb.from("client_goals").select("id").eq("id", goalId).eq("client_id", clientId).maybeSingle();
    if (!goal) throw new Error("Goal not found for this client.");
    const s = data.support;
    const fields = {
      support_text: s.support_text.trim(), details: clean(s.details),
      start_date: s.start_date ?? null, end_date: s.end_date ?? null,
      our_codes: normalizeCodes(s.our_codes),
      ...(s.other_providers ? { other_providers: s.other_providers } : {}),
      ...(s.health_needs ? { health_needs: s.health_needs.map((h) => h.trim()).filter(Boolean) } : {}),
    };
    if (supportId) {
      const { data: rows, error } = await sb
        .from("client_goal_supports").update(fields).eq("id", supportId).eq("goal_id", goalId).select(SUPPORT_COLUMNS);
      if (error) throw new Error(error.message);
      return assertRowsChanged(rows)[0];
    }
    const { count } = await sb.from("client_goal_supports").select("id", { count: "exact", head: true }).eq("goal_id", goalId);
    const { data: rows, error } = await sb
      .from("client_goal_supports")
      .insert({ ...fields, organization_id: organizationId, goal_id: goalId, sort: count ?? 0 })
      .select(SUPPORT_COLUMNS);
    if (error) throw new Error(error.message);
    return assertRowsChanged(rows)[0];
  });

/** End a support today (kept for history). */
export const endGoalSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ...scope, goalId: z.string().uuid(), supportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, userId } = ctx(context);
    await assertCanManageClient({ supabase: sb, actorId: userId, organizationId: data.organizationId, clientId: data.clientId, action: "edit" });
    const { data: goal } = await sb.from("client_goals").select("id").eq("id", data.goalId).eq("client_id", data.clientId).maybeSingle();
    if (!goal) throw new Error("Goal not found for this client.");
    const { data: rows, error } = await sb
      .from("client_goal_supports")
      .update({ end_date: todayYmd() })
      .eq("id", data.supportId)
      .eq("goal_id", data.goalId)
      .select("id");
    if (error) throw new Error(error.message);
    assertRowsChanged(rows);
    return { id: data.supportId };
  });
