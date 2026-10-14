/**
 * Agency Policies binder — what still reads it: a new team member gets the
 * matching policy obligations, and My Obligations opens a policy instance.
 * The admin binder (Agency file → Company policies) was removed in the Nectar
 * rebuild (N4); agency policies live in the Knowledge base. The table has no
 * rows and N8 drops it.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import {
  AGENCY_POLICY_BUCKET,
  staffMatchesPolicyAudience,
  type AgencyPolicyRow,
  type StaffAudienceFacts,
} from "@/lib/agency-policies";
import { ensureOpenStaffObligationInternal } from "@/lib/ensure-staff-obligation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function loadStaffFacts(
  supabase: AnySupabase,
  organizationId: string,
): Promise<Array<{ id: string; full_name: string | null; role: string; facts: StaffAudienceFacts }>> {
  const { data: mems, error: memErr } = await supabase
    .from("organization_members")
    .select("user_id, role:access_level")
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (memErr) throw new Error(memErr.message);
  const members = (mems ?? []) as Array<{ user_id: string; role: string }>;
  const ids = members.map((m) => m.user_id);
  if (!ids.length) return [];

  const [{ data: profs }, { data: assigns }, { data: transport }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, staff_type_keys, position, department")
      .in("id", ids),
    supabase
      .from("staff_assignments")
      .select("staff_id, service_codes")
      .eq("organization_id", organizationId)
      .in("staff_id", ids),
    supabase.from("day_program_transport").select("transport_staff_id").in("transport_staff_id", ids),
  ]);

  const transporters = new Set(
    ((transport ?? []) as Array<{ transport_staff_id: string | null }>)
      .map((r) => r.transport_staff_id)
      .filter((id): id is string => !!id),
  );
  const codesByStaff = new Map<string, string[]>();
  for (const a of (assigns ?? []) as Array<{ staff_id: string; service_codes: string[] | null }>) {
    const list = codesByStaff.get(a.staff_id) ?? [];
    for (const c of a.service_codes ?? []) list.push(c);
    codesByStaff.set(a.staff_id, list);
  }

  const roleById = new Map(members.map((m) => [m.user_id, m.role]));
  return ((profs ?? []) as Array<{
    id: string;
    full_name: string | null;
    staff_type_keys: string[] | null;
    position: string | null;
    department: string | null;
  }>).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: roleById.get(p.id) ?? "staff",
    facts: {
      staffTypeKeys: p.staff_type_keys ?? [],
      position: p.position,
      department: p.department,
      assignedServiceCodes: codesByStaff.get(p.id) ?? [],
      isTransporter:
        transporters.has(p.id) || (codesByStaff.get(p.id) ?? []).some((c) => c.toUpperCase() === "MTP"),
    },
  }));
}

export async function assignMatchingPoliciesForStaffInternal(
  supabase: AnySupabase,
  organizationId: string,
  staffId: string,
): Promise<void> {
  const { data: policies, error } = await supabase
    .from("agency_policies")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("active", true);
  if (error) {
    if (/agency_policies|schema cache|does not exist/i.test(error.message ?? "")) return;
    throw new Error(error.message);
  }
  const rows = (policies ?? []) as AgencyPolicyRow[];
  if (!rows.length) return;

  const all = await loadStaffFacts(supabase, organizationId);
  const staff = all.find((s) => s.id === staffId);
  if (!staff) return;

  for (const policy of rows) {
    if (
      !staffMatchesPolicyAudience(
        { kind: policy.audience_kind, jobCode: policy.audience_job_code },
        staff.facts,
      )
    ) {
      continue;
    }
    if (!policy.obligation_id && !policy.title) continue;
    const titles = policy.title ? [policy.title] : [];
    if (!titles.length) continue;
    await ensureOpenStaffObligationInternal(
      supabase,
      organizationId,
      titles,
      { id: staff.id, full_name: staff.full_name, role: staff.role },
      { dueDays: 30, periodPrefix: "Policy" },
    );
  }
}

export const getAgencyPolicyForInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        instanceId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    if (!supabase || !userId) return { policy: null as AgencyPolicyRow | null, signedUrl: null as string | null };
    await requireOrgMembership(supabase, userId, data.organizationId, "staff");

    const { data: inst, error: iErr } = await supabase
      .from("company_obligation_instances")
      .select("id, obligation_id")
      .eq("id", data.instanceId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!inst) return { policy: null, signedUrl: null };

    const { data: assignee } = await supabase
      .from("company_obligation_instance_assignees")
      .select("staff_id")
      .eq("instance_id", data.instanceId)
      .eq("staff_id", userId)
      .maybeSingle();
    const { data: isAdmin } = await supabase.rpc("is_org_admin_or_manager", {
      _org: data.organizationId,
      _user: userId,
    });
    if (!assignee && !isAdmin) return { policy: null, signedUrl: null };

    const { data: policy, error: pErr } = await supabase
      .from("agency_policies")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("obligation_id", inst.obligation_id)
      .maybeSingle();
    if (pErr) {
      if (/agency_policies|schema cache|does not exist/i.test(pErr.message ?? "")) {
        return { policy: null, signedUrl: null };
      }
      throw new Error(pErr.message);
    }
    if (!policy) return { policy: null, signedUrl: null };

    let signedUrl: string | null = null;
    if (policy.file_path) {
      const { data: signed } = await supabase.storage
        .from(AGENCY_POLICY_BUCKET)
        .createSignedUrl(policy.file_path as string, 3600);
      signedUrl = signed?.signedUrl ?? null;
    }
    return { policy: policy as AgencyPolicyRow, signedUrl };
  });
