// Which access_level / access_preset_id a resent invitation must carry.
//
// An invitation row is written once, at invite time. If the person's access
// is changed on the roster afterwards and the invite is then resent, the old
// values on the row would be what accept_invitation applies when they join —
// silently restoring the access they had before the change. Resend therefore
// always rewrites both columns: from the values the caller passes in, or
// else from the member's current organization_members row.
//
// Pure and alias-free so node --test can import it; invitations.functions.ts
// does the reads and the update.

import type { AccessLevel } from "./access/levels.ts";

export interface InviteAccessValues {
  access_level: AccessLevel;
  access_preset_id: string | null;
}

export interface MemberAccessPick {
  user_id: string;
  access_level: string | null;
  access_preset_id: string | null;
}

export interface ProfileEmailPick {
  id: string;
  email: string | null;
}

const LEVELS: readonly string[] = ["owner", "admin", "staff"];

/**
 * Two separate queries (organization_members, profiles) joined here by email —
 * they share no FK, so they are never PostgREST-embedded. Case-insensitive.
 */
export function findMemberAccessByEmail(
  email: string,
  members: readonly MemberAccessPick[],
  profiles: readonly ProfileEmailPick[],
): InviteAccessValues | null {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return null;
  const userId = profiles.find((p) => (p.email ?? "").trim().toLowerCase() === wanted)?.id;
  if (!userId) return null;
  const member = members.find((m) => m.user_id === userId);
  if (!member) return null;
  const level = LEVELS.includes(member.access_level ?? "") ? (member.access_level as AccessLevel) : "staff";
  // Owners never carry a preset; keep the stored preset for everyone else.
  return { access_level: level, access_preset_id: level === "owner" ? null : member.access_preset_id };
}

/**
 * The columns to write on resend. Explicitly requested values win; otherwise
 * the member's current values. null when neither exists (a pure email invite
 * for someone not on the roster yet) — leave the row's own values alone.
 */
export function resolveResendAccess(args: {
  requested: InviteAccessValues | null | undefined;
  member: InviteAccessValues | null | undefined;
}): InviteAccessValues | null {
  if (args.requested) return args.requested;
  if (args.member) return args.member;
  return null;
}
