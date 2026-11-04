// Pure rules for pending team-member invites: who sees one in the Invited view,
// who may cancel it, and how the cached Invited list changes when an invite or
// a person goes away. No Supabase, no aliases — importable by node --test.
// Callers: listTeamInvites (invites.functions.ts), revokeInvitation
// (invite-cancel.functions.ts), InvitesView / CancelInviteDialog, useMemberLeft.
//
// Deleting or deactivating a person cancels their pending invites in the
// database (trg_member_leave_revokes_invites); nothing here re-checks that.

import { isOwner, type AccessScope } from "../access/levels.ts";
// Type-only: erased at runtime, so node --test never loads roster.ts from here.
import type { TeamInviteRow } from "./roster.ts";

/** An email as invites compare it: trimmed, lower case. */
export function inviteEmailKey(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

/**
 * The Invited view's visibility rule. Agency-wide viewers see every pending
 * invite; scoped viewers see the ones they sent and the ones for people they
 * can see (visibleEmails holds those people's emails, as inviteEmailKey).
 */
export function inviteVisibleTo(args: {
  scope: AccessScope;
  viewerId: string;
  invitedBy: string | null;
  email: string;
  visibleEmails: ReadonlySet<string>;
}): boolean {
  return (
    args.scope === "agency" ||
    args.invitedBy === args.viewerId ||
    args.visibleEmails.has(inviteEmailKey(args.email))
  );
}

export const CANCEL_OWNER_INVITE_MESSAGE = "Only an Owner can cancel an invite to be an Owner.";

/** Why this viewer can't cancel the invite, or null. Only an Owner acts on an Owner. */
export function cancelInviteBlockedReason(
  inviteLevel: string | null | undefined,
  viewerIsOwner: boolean,
): string | null {
  return isOwner(inviteLevel) && !viewerIsOwner ? CANCEL_OWNER_INVITE_MESSAGE : null;
}

/** The Uninvite dialog's question: the person's name, or the email when there's no name. */
export function cancelInviteQuestion(row: { name: string | null; email: string }): string {
  return `Cancel invite for ${row.name?.trim() || row.email}?`;
}

export const INVITE_CANCELED_TOAST = "Invite canceled.";

/** The cached Invited list once this invite is canceled. */
export function withoutInvite(
  rows: readonly TeamInviteRow[],
  invitationId: string,
): TeamInviteRow[] {
  return rows.filter((r) => r.invitationId !== invitationId);
}

/** The cached Invited list once this person is deleted or deactivated: none of their rows. */
export function withoutPersonInvites(
  rows: readonly TeamInviteRow[],
  userId: string,
): TeamInviteRow[] {
  return rows.filter((r) => r.userId !== userId);
}
