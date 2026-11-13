// Server checks shared by the actions on one pending invite (Resend in
// invites.functions.ts, Uninvite in invite-cancel.functions.ts): can this viewer
// see the invite on their Invited view, and what to say when it's gone, used or
// canceled. The rules themselves are pure, in invite-rules.ts. Callers run their
// category check first and pass the service-role client.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessScope } from "@/lib/access/levels";
import { inviteEmailKey, inviteVisibleTo } from "@/lib/team-members/invite-rules";
import { loadVisibleMembers } from "@/lib/team-members/roster.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any>;

export const INVITE_GONE_MESSAGE =
  "This invite is no longer on your Invited list. Refresh the page.";
export const INVITE_USED_MESSAGE =
  "They already joined with this invite. To remove their access, deactivate them.";
export const INVITE_CANCELED_MESSAGE =
  "This invite was canceled, so it can't be resent. Refresh the page.";
export const DEACTIVATED_INVITE_MESSAGE =
  "They're deactivated. Reactivate them first, then send the invite.";

/** The Invited view's rule (listTeamInvites). Throws INVITE_GONE_MESSAGE when they can't see it. */
export async function assertCanSeeInvite(args: {
  admin: Sb;
  organizationId: string;
  viewerId: string;
  scope: AccessScope;
  invite: { email: string; invited_by: string | null };
}): Promise<void> {
  const { admin, organizationId, viewerId, scope, invite } = args;
  if (scope === "agency" || invite.invited_by === viewerId) return;
  const { members, profiles } = await loadVisibleMembers({
    admin,
    organizationId,
    viewerId,
    scope,
  });
  const visibleEmails = new Set(
    members.map((m) => inviteEmailKey(profiles.get(m.user_id)?.email)).filter(Boolean),
  );
  const visible = inviteVisibleTo({
    scope,
    viewerId,
    invitedBy: invite.invited_by,
    email: invite.email,
    visibleEmails,
  });
  if (!visible) throw new Error(INVITE_GONE_MESSAGE);
}
