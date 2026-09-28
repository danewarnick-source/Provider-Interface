import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireOrgMembershipAdmin } from "@/integrations/supabase/require-org";
import { assertCanManageMember } from "@/lib/team-members/guards.server";

const Kind = z.enum(["employee", "client"]);

// Cross-org guard for every service-role write in this file. Verifies, BEFORE
// any write happens, that
//   (a) the CALLER has an ACTIVE membership in the organization they claim to
//       act for, and
//   (b) the TARGET actually belongs to that same organization (staff via
//       organization_members; clients via clients.organization_id).
// Without (b), the service-role writes below (which bypass RLS) could touch a
// profile/user/client in a DIFFERENT org just by passing that record's id — a
// cross-organization IDOR. The target-staff check accepts a membership row
// regardless of its `active` flag on purpose: archiveEntity sets active=false,
// and restoreEntity then runs on that already-deactivated team member, so an
// active-only check would break that legitimate flow. Existence of any row
// still proves same-org ownership. (There is no hard delete: people and their
// work records are never removed, only deactivated.)
async function assertCallerAndTargetInOrg(
  actorId: string,
  kind: "employee" | "client",
  targetId: string,
  orgId: string,
) {
  const { data: myOrgs } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", actorId)
    .eq("active", true);
  const mine = new Set((myOrgs ?? []).map((r) => r.organization_id));
  if (!mine.has(orgId)) {
    throw new Error("Not authorized for this organization");
  }

  if (kind === "employee") {
    const { data } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", targetId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!data) throw new Error("Not authorized for this organization");
  } else {
    const { data } = await supabaseAdmin
      .from("clients")
      .select("organization_id")
      .eq("id", targetId)
      .maybeSingle();
    if (!data || data.organization_id !== orgId) {
      throw new Error("Not authorized for this organization");
    }
  }
}

async function staffActiveBlockers(_staffId: string, _orgId: string) {
  // Time-clock module removed; no active-shift blockers to check.
  return null;
}

async function clientActiveBlockers(clientId: string, orgId: string) {
  // Unsubmitted (pending_approval) daily logs serve as billable claims pending
  const { data: pending } = await supabaseAdmin
    .from("daily_logs")
    .select("id")
    .eq("organization_id", orgId)
    .eq("client_id", clientId)
    .eq("status", "pending_approval")
    .limit(1);
  if (pending && pending.length) {
    return "Action Blocked: This client has unsubmitted billable claims pending. Please finalize the billing export before removal.";
  }
  return null;
}

export const archiveEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: Kind,
      id: z.string().uuid(),
      organizationId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    if (!context.userId) return { ok: false };
    await assertCallerAndTargetInOrg(context.userId, data.kind, data.id, data.organizationId);

    if (data.kind === "employee") {
      await assertCanManageMember({
        supabase: supabaseAdmin,
        actorId: context.userId,
        organizationId: data.organizationId,
        targetUserId: data.id,
        action: "deactivate",
      });
      const blocker = await staffActiveBlockers(data.id, data.organizationId);
      if (blocker) throw new Error(blocker);

      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .update({ account_status: "archived", team_id: null, is_active: false })
        .eq("id", data.id);
      if (pErr) throw new Error(pErr.message);

      await supabaseAdmin
        .from("organization_members")
        .update({ active: false })
        .eq("user_id", data.id)
        .eq("organization_id", data.organizationId);

      // Log the deactivation, then kill any still-live JWT sessions so the
      // deactivated staffer can't keep hitting server functions that check
      // membership via the admin client (which runs before RLS).
      await supabaseAdmin.rpc("flag_member_deactivated", {
        _org_id: data.organizationId,
        _user_id: data.id,
        _changed_by_user_id: context.userId,
      }).then(({ error }) => {
        if (error) console.error("flag_member_deactivated failed:", error.message);
      });
      await supabaseAdmin.auth.admin.signOut(data.id, "global").catch((e) =>
        console.error("Failed to sign out deactivated user's sessions:", e),
      );
    } else {
      // Clients aren't team members, so the member guard doesn't apply; keep the
      // gate this branch always had: Owner or agency-wide Admin.
      await requireOrgMembershipAdmin(supabaseAdmin, context.userId, data.organizationId, "admin");
      const blocker = await clientActiveBlockers(data.id, data.organizationId);
      if (blocker) throw new Error(blocker);

      const { error } = await supabaseAdmin
        .from("clients")
        .update({ account_status: "archived", team_id: null })
        .eq("id", data.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Reverse of archiveEntity — puts a deactivated employee back on the Active roster. */
export const restoreEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: Kind,
      id: z.string().uuid(),
      organizationId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    if (!context.userId) return { ok: false };
    await assertCallerAndTargetInOrg(context.userId, data.kind, data.id, data.organizationId);

    if (data.kind === "employee") {
      await assertCanManageMember({
        supabase: supabaseAdmin,
        actorId: context.userId,
        organizationId: data.organizationId,
        targetUserId: data.id,
        action: "reactivate",
      });
      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .update({ account_status: "active", is_active: true })
        .eq("id", data.id);
      if (pErr) throw new Error(pErr.message);

      const { error: mErr } = await supabaseAdmin
        .from("organization_members")
        .update({ active: true })
        .eq("user_id", data.id)
        .eq("organization_id", data.organizationId);
      if (mErr) throw new Error(mErr.message);
    } else {
      await requireOrgMembershipAdmin(supabaseAdmin, context.userId, data.organizationId, "admin");
      const { error } = await supabaseAdmin
        .from("clients")
        .update({ account_status: "active" })
        .eq("id", data.id)
        .eq("organization_id", data.organizationId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

