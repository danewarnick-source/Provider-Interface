// Saves one Scheduling settings control at a time (every control saves on
// change). Only the Owner may change settings; a home's lead may also sign a
// new hire off there (RLS enforces both). Read side: settings.functions.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { isOwner } from "@/lib/access/levels";
import { SETTING_RULES, strengthChoices } from "@/lib/scheduler/rules-strength";

const Org = z.string().uuid();
const Id = z.string().uuid();
const OWNER_ONLY = "Only the owner can change scheduling settings.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { supabase: any; userId: string };

async function owner(
  context: { supabase?: unknown; userId?: string | null },
  orgId: string,
): Promise<Ctx> {
  const { supabase, userId } = context as { supabase: Ctx["supabase"]; userId: string | null };
  if (!supabase || !userId) throw new Error("Sign in again to change settings.");
  const access = await requireOrgMembership(supabase, userId, orgId).catch(() => {
    throw new Error(OWNER_ONLY);
  });
  if (!isOwner(access.level)) throw new Error(OWNER_ONLY);
  return { supabase, userId };
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const Hour = z.number().int().min(0).max(23);
const AgencyPatch = z
  .object({
    ot_threshold_hours: z.number().int().min(1).max(80),
    hours_cap: z.number().int().min(1).max(168),
    min_rest_hours: z.number().int().min(0).max(24),
    max_days_in_row: z.number().int().min(1).max(14),
    max_hours_in_row: z.number().int().min(1).max(48),
    claim_mode: z.enum(["first", "approve"]),
    quiet_start: Hour,
    quiet_end: Hour,
    urgent_hours: z.number().int().min(1).max(24),
    escalation_waits: z.array(z.number().int().min(1).max(120)).length(3),
    holdover_ask: z.boolean(),
    holdover_visible: z.boolean(),
    workweek_start: z.union([z.literal(0), z.literal(1)]),
    ot_multiplier: z.number().min(1).max(3),
    sleep_rate: z.number().min(0).max(100),
    oncall_stipend: z.number().min(0).max(1000),
    night_diff: z.number().positive().max(20).nullable(),
    weekend_diff: z.number().positive().max(20).nullable(),
    reminder_minutes: z.number().int().min(0).max(1440),
    digest: z.boolean(),
    location_at_punch_only: z.boolean(),
  })
  .partial();

export const saveAgencySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; patch: z.infer<typeof AgencyPatch> }) =>
    z.object({ organizationId: Org, patch: AgencyPatch }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = await owner(context, data.organizationId);
    const { error } = await supabase
      .from("org_shift_behavior_settings")
      .update({ ...data.patch, updated_at: new Date().toISOString(), updated_by: userId })
      .eq("organization_id", data.organizationId);
    check(error);
    return { ok: true };
  });

/** A rule's agency default, or a home's override (null strength = use the agency default). */
export const saveRuleStrength = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { organizationId: string; key: string; strength: string | null; teamId?: string | null }) =>
      z
        .object({
          organizationId: Org,
          key: z.string(),
          strength: z.enum(["off", "warn", "reason", "block"]).nullable(),
          teamId: Id.nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = await owner(context, data.organizationId);
    const rule = SETTING_RULES.find((r) => r.key === data.key);
    if (!rule) throw new Error("That rule can't be changed here.");
    if (data.strength && !strengthChoices(rule).includes(data.strength)) {
      throw new Error(`${rule.label} is a state rule and can't be turned off.`);
    }
    if (!data.teamId) {
      if (!data.strength) throw new Error("Pick a strength for the agency default.");
      const { data: row, error } = await supabase
        .from("org_shift_behavior_settings")
        .select("rule_settings")
        .eq("organization_id", data.organizationId)
        .single();
      check(error);
      const rule_settings = { ...(row.rule_settings ?? {}), [data.key]: data.strength };
      check(
        (
          await supabase
            .from("org_shift_behavior_settings")
            .update({ rule_settings, updated_by: userId, updated_at: new Date().toISOString() })
            .eq("organization_id", data.organizationId)
        ).error,
      );
      return { ok: true };
    }
    const { data: row, error } = await supabase
      .from("team_schedule_settings")
      .select("rule_overrides")
      .eq("team_id", data.teamId)
      .maybeSingle();
    check(error);
    const rule_overrides: Record<string, string> = { ...(row?.rule_overrides ?? {}) };
    if (data.strength) rule_overrides[data.key] = data.strength;
    else delete rule_overrides[data.key];
    check(
      (
        await supabase.from("team_schedule_settings").upsert({
          team_id: data.teamId,
          organization_id: data.organizationId,
          rule_overrides,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
      ).error,
    );
    return { ok: true };
  });

const Approver = z.enum(["lead", "owner"]).nullable();
const HomePatch = z
  .object({
    overnight_pay: z.enum(["every", "sleeprate", "exclude"]).nullable(),
    premium_per_hour: z.number().positive().max(50).nullable(),
    pickup_approval: z.enum(["auto", "lead", "owner"]).nullable(),
    swap_approval: Approver,
    timeoff_approval: Approver,
    fix_approval: Approver,
    publish_approval: Approver,
  })
  .partial();

/** One home's own value for a setting; null = "Use agency default". */
export const saveHomeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { organizationId: string; teamId: string; patch: z.infer<typeof HomePatch> }) =>
      z.object({ organizationId: Org, teamId: Id, patch: HomePatch }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = await owner(context, data.organizationId);
    check(
      (
        await supabase.from("team_schedule_settings").upsert({
          team_id: data.teamId,
          organization_id: data.organizationId,
          ...data.patch,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
      ).error,
    );
    return { ok: true };
  });

/** The home's lead (teams.manager_id): runs the home and reviews its notes. */
export const setHomeLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; teamId: string; leadId: string | null }) =>
    z.object({ organizationId: Org, teamId: Id, leadId: Id.nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = await owner(context, data.organizationId);
    check(
      (
        await supabase
          .from("teams")
          .update({ manager_id: data.leadId })
          .eq("id", data.teamId)
          .eq("organization_id", data.organizationId)
      ).error,
    );
    return { ok: true };
  });

/** A holiday's pay: a multiplier, or null for "Not paid extra". */
export const setHolidayPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; holidayId: string; multiplier: number | null }) =>
    z
      .object({
        organizationId: Org,
        holidayId: Id,
        multiplier: z.number().min(1).max(3).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = await owner(context, data.organizationId);
    check(
      (
        await supabase
          .from("agency_holidays")
          .update({ pay_multiplier: data.multiplier })
          .eq("id", data.holidayId)
          .eq("organization_id", data.organizationId)
      ).error,
    );
    return { ok: true };
  });
