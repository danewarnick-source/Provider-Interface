// Shared server-side org membership guard.
//
// Every org-scoped server fn calls requireOrgMembership(...) as the first line
// of its handler, BEFORE any read/write, so we verify the caller actually
// belongs to the organization they claim to act on. RLS remains the backstop.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { isLevelAtLeast, type AccessLevel } from "@/lib/access/levels";
import { MEMBER_ACCESS_SELECT, resolveMemberAccess, type MemberAccess, type MemberAccessRow } from "@/lib/access/member";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(label: string, value: unknown): asserts value is string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${label}: not a UUID`);
  }
}

type AnySupabase = SupabaseClient<Database> | SupabaseClient;

async function checkMembership(
  client: AnySupabase,
  userId: string,
  organizationId: string,
  minLevel: AccessLevel,
): Promise<MemberAccess> {
  assertUuid("organizationId", organizationId);
  assertUuid("userId", userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("organization_members")
    .select(MEMBER_ACCESS_SELECT)
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  // RLS hiding the row also means "not a member".
  if (error || !data?.access_level) throw new Error("Not a member of this organization");

  const access = resolveMemberAccess(data as MemberAccessRow);
  if (!isLevelAtLeast(access.level, minLevel)) {
    throw new Error(`Insufficient access: requires ${minLevel} or higher (have ${access.level})`);
  }
  return access;
}

/**
 * Verify the authenticated caller is an ACTIVE member of organizationId with
 * at least minLevel. Uses the USER-scoped Supabase client so RLS also applies.
 */
export async function requireOrgMembership(
  supabase: AnySupabase,
  userId: string,
  organizationId: string,
  minLevel: AccessLevel = "staff",
): Promise<MemberAccess> {
  return checkMembership(supabase, userId, organizationId, minLevel);
}

/**
 * Same check for handlers that use the admin client (RLS bypassed). Because RLS
 * won't narrow rows to an assigned-scope Admin's homes/staff/clients, Admin-level
 * calls require whole-agency scope unless the handler filters rows itself.
 */
export async function requireOrgMembershipAdmin(
  supabaseAdmin: AnySupabase,
  userId: string,
  organizationId: string,
  minLevel: AccessLevel = "staff",
  opts: { allowAssignedScope?: boolean } = {},
): Promise<MemberAccess> {
  const access = await checkMembership(supabaseAdmin, userId, organizationId, minLevel);
  if (minLevel === "admin" && access.level === "admin" && access.scope !== "agency" && !opts.allowAssignedScope) {
    throw new Error("Insufficient access: requires whole-agency scope");
  }
  return access;
}
