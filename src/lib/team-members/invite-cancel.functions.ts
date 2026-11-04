// Cancel one pending team-member invite: the Uninvite button on the roster's
// Invited view. The old join link stops working (/join: "This invite is no
// longer valid."). Deleting or deactivating someone cancels their invites in
// the database instead (trg_member_leave_revokes_invites).
//
// Checks first, with the same rules as the Invited view: Hire & deactivate
// Edit, scoped viewers only for invites they can see, and only an Owner
// cancels an invite to be an Owner. Live RLS lets only Owners write
// invitations, so the write itself uses the service-role client.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCategory } from "@/lib/access/require";
import {
  cancelInviteBlockedReason,
  inviteEmailKey,
  inviteVisibleTo,
} from "@/lib/team-members/invite-rules";
import { loadVisibleMembers } from "@/lib/team-members/roster.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

export const INVITE_GONE_MESSAGE =
  "This invite is no longer on your Invited list. Refresh the page.";
export const INVITE_USED_MESSAGE =
  "They already joined with this invite. To remove their access, deactivate them.";

type InviteRow = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "revoked";
  access_level: string | null;
  invited_by: string | null;
};

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; invitation_id: string }) =>
    z.object({ organization_id: z.string().uuid(), invitation_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ invitationId: string }> => {
    const { supabase, userId } = context;
    if (!supabase || !userId) throw new Error("Not signed in.");
    const orgId = data.organization_id;
    const access = await requireCategory(
      supabase as unknown as Sb,
      userId,
      orgId,
      "staff_hiring",
      "edit",
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as Sb;

    const { data: found, error } = await admin
      .from("invitations")
      .select("id, email, status, access_level, invited_by")
      .eq("id", data.invitation_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const invite = found as InviteRow | null;
    if (!invite) throw new Error(INVITE_GONE_MESSAGE);

    if (access.scope !== "agency" && invite.invited_by !== userId) {
      const { members, profiles } = await loadVisibleMembers({
        admin,
        organizationId: orgId,
        viewerId: userId,
        scope: access.scope,
      });
      const visibleEmails = new Set(
        members.map((m) => inviteEmailKey(profiles.get(m.user_id)?.email)).filter(Boolean),
      );
      const visible = inviteVisibleTo({
        scope: access.scope,
        viewerId: userId,
        invitedBy: invite.invited_by,
        email: invite.email,
        visibleEmails,
      });
      if (!visible) throw new Error(INVITE_GONE_MESSAGE);
    }
    const blocked = cancelInviteBlockedReason(invite.access_level, access.level === "owner");
    if (blocked) throw new Error(blocked);
    if (invite.status === "accepted") throw new Error(INVITE_USED_MESSAGE);

    // Already canceled counts as done: the row leaves the list either way.
    if (invite.status === "pending") {
      const { error: upErr } = await admin
        .from("invitations")
        .update({ status: "revoked" })
        .eq("id", invite.id)
        .eq("organization_id", orgId)
        .eq("status", "pending");
      if (upErr) throw new Error(upErr.message);
    }
    return { invitationId: invite.id };
  });
