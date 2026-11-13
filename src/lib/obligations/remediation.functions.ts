// Server functions for remediation plans, overrides, and This Week.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import {
  emptyAlreadyAssigned,
  emptyAutomationHeartbeat,
  emptyQuietLine,
  getThisWeek,
  type ThisWeekResult,
} from "./this-week.functions.ts";
import {
  initialRemediationPlanStatus,
  loadAwaitingApprovalPlans,
  resolveEscalationsForPlan,
  tableMissing,
  type RemediationPlanKind,
  type RemediationPlanRow,
} from "./remediation.ts";
import {
  buildOverrideInsert,
  overrideIsActive,
  parseOverrideScope,
  type OverrideRow,
  type OverrideScope,
} from "./overrides.ts";
import type { SoloLapse } from "./solo-lapse.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const KIND_Z = z.enum([
  "solo_lapse",
  "scheduled_while_lapsed",
  "overdue",
  "standing_missing",
  "license_risk",
]);

async function requireManager(
  supabase: AnySupabase,
  userId: string,
  organizationId: string,
): Promise<void> {
  await requireOrgMembership(supabase, userId, organizationId, "admin");
}

export const getThisWeekForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organizationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<ThisWeekResult> => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) {
      return {
        items: [],
        quiet: emptyQuietLine(),
        alreadyAssigned: emptyAlreadyAssigned(),
        automation: emptyAutomationHeartbeat(),
      };
    }
    await requireOrgMembership(supabase, userId, data.organizationId, "staff");
    return getThisWeek(supabase, data.organizationId, userId);
  });

const OVERRIDE_SCOPE_Z = z.enum(["instance", "staff_clock", "shift"]);

const OVERRIDE_SELECT =
  "id, organization_id, staff_id, obligation_id, instance_id, obligation_key, gap_key, gap_type, kind, reason, expires_at, created_by, created_at, shift_id";

export type ObligationOverrideView = OverrideRow & {
  scope: OverrideScope | null;
  active: boolean;
  authorized_by: string | null;
};

async function insertObligationOverride(
  supabase: AnySupabase,
  userId: string,
  data: {
    organizationId: string;
    staffId: string;
    obligationKey: string;
    obligationId?: string | null;
    instanceId?: string | null;
    shiftId?: string | null;
    scope: OverrideScope;
    reason: string;
    expiresAt: string;
  },
  now: Date = new Date(),
): Promise<{ id: string }> {
  const payload = buildOverrideInsert({
    organizationId: data.organizationId,
    staffId: data.staffId,
    obligationKey: data.obligationKey,
    obligationId: data.obligationId,
    instanceId: data.instanceId,
    shiftId: data.shiftId,
    scope: data.scope,
    reason: data.reason,
    expiresAt: data.expiresAt,
    createdBy: userId,
    now,
  });
  const { data: row, error } = await supabase
    .from("compliance_overrides")
    .insert(payload)
    .select("id")
    .single();
  if (error) {
    if (tableMissing(error.message)) {
      throw new Error("Overrides are not available yet.");
    }
    throw new Error(error.message);
  }
  return { id: (row as { id: string }).id };
}

async function mapOverrideViews(
  supabase: AnySupabase,
  rows: OverrideRow[],
  now: Date,
): Promise<ObligationOverrideView[]> {
  const actorIds = Array.from(
    new Set(rows.map((r) => r.created_by).filter((id): id is string => !!id)),
  );
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data: dir, error } = await supabase
      .from("org_member_directory")
      .select("id, full_name")
      .in("id", actorIds);
    if (error && !tableMissing(error.message)) throw new Error(error.message);
    for (const person of (dir ?? []) as Array<{ id: string | null; full_name: string | null }>) {
      if (person.id && person.full_name) names.set(person.id, person.full_name);
    }
  }
  return rows.map((row) => ({
    ...row,
    scope: parseOverrideScope(row.gap_type) ?? parseOverrideScope(row.kind),
    active: overrideIsActive(row.expires_at, now),
    authorized_by: row.created_by ? (names.get(row.created_by) ?? row.created_by) : null,
  }));
}

export const recordObligationOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        staffId: z.string().uuid(),
        obligationKey: z.string().min(1).max(80),
        obligationId: z.string().uuid().nullable().optional(),
        instanceId: z.string().uuid().nullable().optional(),
        reason: z.string().min(8).max(500),
        scope: OVERRIDE_SCOPE_Z,
        expiresAt: z.string().min(1),
        shiftId: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) throw new Error("Not authenticated");
    await requireManager(supabase, userId, data.organizationId);
    return insertObligationOverride(supabase, userId, data);
  });

export const listOverridesForStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        staffId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<ObligationOverrideView[]> => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) return [];
    if (data.staffId === userId) {
      await requireOrgMembership(supabase, userId, data.organizationId, "staff");
    } else {
      await requireManager(supabase, userId, data.organizationId);
    }
    const { data: rows, error } = await supabase
      .from("compliance_overrides")
      .select(OVERRIDE_SELECT)
      .eq("organization_id", data.organizationId)
      .eq("staff_id", data.staffId)
      .order("created_at", { ascending: true });
    if (error) {
      if (tableMissing(error.message)) return [];
      throw new Error(error.message);
    }
    return mapOverrideViews(supabase, (rows ?? []) as OverrideRow[], new Date());
  });

export const listOverridesForOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organizationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<ObligationOverrideView[]> => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) return [];
    await requireManager(supabase, userId, data.organizationId);
    const { data: rows, error } = await supabase
      .from("compliance_overrides")
      .select(OVERRIDE_SELECT)
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: true });
    if (error) {
      if (tableMissing(error.message)) return [];
      throw new Error(error.message);
    }
    return mapOverrideViews(supabase, (rows ?? []) as OverrideRow[], new Date());
  });

export const proposeRemediationPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        kind: KIND_Z,
        title: z.string().min(1).max(200),
        planText: z.string().min(8).max(2000),
        obligationKey: z.string().max(80).nullable().optional(),
        obligationId: z.string().uuid().nullable().optional(),
        instanceId: z.string().uuid().nullable().optional(),
        staffId: z.string().uuid().nullable().optional(),
        dueAt: z.string().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) throw new Error("Not authenticated");
    await requireManager(supabase, userId, data.organizationId);
    if (
      (data.kind === "license_risk" ||
        data.kind === "standing_missing" ||
        data.kind === "overdue") &&
      !data.dueAt
    ) {
      throw new Error("Due date is required.");
    }
    const status = initialRemediationPlanStatus(data.kind);
    const now = new Date().toISOString();
    const { data: row, error } = await supabase
      .from("remediation_plans")
      .insert({
        organization_id: data.organizationId,
        kind: data.kind,
        title: data.title,
        plan_text: data.planText,
        obligation_key: data.obligationKey ?? null,
        obligation_id: data.obligationId ?? null,
        instance_id: data.instanceId ?? null,
        staff_id: data.staffId ?? null,
        due_at: data.dueAt ?? null,
        status,
        proposed_by: userId,
        ...(status === "approved"
          ? {
              reviewed_by: userId,
              reviewed_at: now,
              outcome: "approved",
              outcome_at: now,
            }
          : {}),
      })
      .select("id, instance_id, obligation_id")
      .single();
    if (error) {
      if (tableMissing(error.message)) {
        throw new Error(
          "Remediation plans table is not live yet. Soft Core must apply Step 4 SQL.",
        );
      }
      if (/duplicate|unique/i.test(error.message)) {
        const existing = await loadAwaitingApprovalPlans(supabase, data.organizationId);
        const match = existing.find(
          (p) =>
            p.kind === data.kind &&
            (data.instanceId
              ? p.instance_id === data.instanceId
              : p.obligation_id === data.obligationId),
        );
        if (match) return { id: match.id };
      }
      throw new Error(error.message);
    }
    const created = row as Pick<RemediationPlanRow, "id" | "instance_id" | "obligation_id">;
    if (status === "approved") {
      await resolveEscalationsForPlan(supabase, data.organizationId, created);
    }
    return { id: created.id };
  });

export const reviewRemediationPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        planId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) throw new Error("Not authenticated");
    await requireManager(supabase, userId, data.organizationId);
    const now = new Date().toISOString();
    const { data: plan, error: getErr } = await supabase
      .from("remediation_plans")
      .select("id, instance_id, obligation_id, status")
      .eq("organization_id", data.organizationId)
      .eq("id", data.planId)
      .maybeSingle();
    if (getErr) {
      if (tableMissing(getErr.message)) {
        throw new Error(
          "Remediation plans table is not live yet. Soft Core must apply Step 4 SQL.",
        );
      }
      throw new Error(getErr.message);
    }
    if (!plan) throw new Error("Plan not found");
    const row = plan as Pick<RemediationPlanRow, "id" | "instance_id" | "obligation_id" | "status">;
    if (row.status !== "awaiting_approval" && row.status !== "draft") {
      throw new Error("Plan is no longer awaiting approval");
    }
    const { error } = await supabase
      .from("remediation_plans")
      .update({
        status: data.decision,
        outcome: data.decision,
        outcome_note: data.note ?? null,
        outcome_at: now,
        reviewed_by: userId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", data.planId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    if (data.decision === "approved") {
      await resolveEscalationsForPlan(supabase, data.organizationId, row);
    }
    return { ok: true };
  });

export type { RemediationPlanKind, SoloLapse };
