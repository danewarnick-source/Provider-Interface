import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logChange } from "@/lib/access/change-log.server";
import { assertCanManageMember } from "@/lib/team-members/guards.server";
import { SEPARATION_REASONS } from "@/lib/team-members/profile";

// Deactivate / Reactivate a team member in ONE agency. Nothing is ever
// deleted: people and their work records stay; only this agency's membership
// turns off. assertCanManageMember runs first and proves the target has a
// membership row in this organization (any `active` flag, so Reactivate works
// on someone already deactivated) — that is the cross-org guard for every
// service-role write below.

const YMD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const MemberTarget = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

/** Other agencies where this person is still active. */
async function otherActiveMemberships(userId: string, organizationId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("user_id", userId)
    .eq("active", true)
    .neq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export const deactivateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    MemberTarget.extend({
      lastDay: YMD,
      reason: z.enum(SEPARATION_REASONS),
      rehireEligible: z.boolean(),
      note: z.string().trim().max(5000).optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!context.userId) throw new Error("Not signed in.");
    const actorId = context.userId;
    await assertCanManageMember({
      supabase: supabaseAdmin,
      actorId,
      organizationId: data.organizationId,
      targetUserId: data.userId,
      action: "deactivate",
    });

    const { data: rows, error: mErr } = await supabaseAdmin
      .from("organization_members")
      .update({
        active: false,
        end_date: data.lastDay,
        separation_reason: data.reason,
        rehire_eligible: data.rehireEligible,
      })
      .eq("user_id", data.userId)
      .eq("organization_id", data.organizationId)
      .select("id");
    if (mErr) throw new Error(mErr.message);
    if (!rows?.length) throw new Error("Team member not found in this organization");

    if (data.note) {
      const { error: noteErr } = await supabaseAdmin.from("staff_notes").insert({
        organization_id: data.organizationId,
        staff_id: data.userId,
        author_id: actorId,
        kind: "note",
        body: data.note,
      });
      if (noteErr) throw new Error(noteErr.message);
    }

    // The profile is shared across agencies: only mark it inactive, and only
    // end their sessions, when no other agency still has them active.
    // profiles.team_id is never touched.
    const stillActiveElsewhere =
      (await otherActiveMemberships(data.userId, data.organizationId)) > 0;
    if (!stillActiveElsewhere) {
      const { error: pErr } = await supabaseAdmin
        .from("profiles")
        .update({ account_status: "archived", is_active: false })
        .eq("id", data.userId);
      if (pErr) throw new Error(pErr.message);
    }

    const { error: flagErr } = await supabaseAdmin.rpc("flag_member_deactivated", {
      _org_id: data.organizationId,
      _user_id: data.userId,
      _changed_by_user_id: actorId,
    });
    if (flagErr) console.error("flag_member_deactivated failed:", flagErr.message);

    if (!stillActiveElsewhere) {
      await supabaseAdmin.auth.admin
        .signOut(data.userId, "global")
        .catch((e) => console.error("Failed to sign out deactivated user's sessions:", e));
    }
    return { ok: true };
  });

/** Reverse of deactivateMember — back on this agency's Active roster. */
export const reactivateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MemberTarget.parse(d))
  .handler(async ({ data, context }) => {
    if (!context.userId) throw new Error("Not signed in.");
    await assertCanManageMember({
      supabase: supabaseAdmin,
      actorId: context.userId,
      organizationId: data.organizationId,
      targetUserId: data.userId,
      action: "reactivate",
    });

    const { data: before, error: readErr } = await supabaseAdmin
      .from("organization_members")
      .select("id, end_date, separation_reason, rehire_eligible")
      .eq("user_id", data.userId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!before) throw new Error("Team member not found in this organization");

    const { data: rows, error: mErr } = await supabaseAdmin
      .from("organization_members")
      .update({ active: true, end_date: null, separation_reason: null, rehire_eligible: null })
      .eq("id", before.id)
      .eq("organization_id", data.organizationId)
      .select("id");
    if (mErr) throw new Error(mErr.message);
    if (!rows?.length) throw new Error("Team member not found in this organization");

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ account_status: "active", is_active: true })
      .eq("id", data.userId);
    if (pErr) throw new Error(pErr.message);

    await logChange(
      data.organizationId,
      context.userId,
      "reactivated",
      { userId: data.userId },
      {
        end_date: before.end_date,
        separation_reason: before.separation_reason,
        rehire_eligible: before.rehire_eligible,
      },
    );
    return { ok: true };
  });
