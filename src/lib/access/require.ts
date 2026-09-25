// Server-side access gates. Throw so the server fn returns an error — never silently pass.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { hasCategory, hasPermission } from "./can";
import type { CategoryId } from "./categories";
import type { AccessLevel } from "./levels";
import type { MemberAccess } from "./member";

type AnySupabase = SupabaseClient<Database> | SupabaseClient;

export async function requireLevel(
  supabase: AnySupabase,
  userId: string,
  organizationId: string,
  minLevel: AccessLevel,
): Promise<MemberAccess> {
  return requireOrgMembership(supabase, userId, organizationId, minLevel);
}

export async function requireCategory(
  supabase: AnySupabase,
  userId: string,
  organizationId: string,
  category: CategoryId,
  min: "view" | "edit" = "view",
): Promise<MemberAccess> {
  const access = await requireOrgMembership(supabase, userId, organizationId);
  if (!hasCategory(access.categories, category, min)) {
    throw new Error(`Forbidden: requires ${min} on ${category}`);
  }
  return access;
}

/** Legacy permission keys resolve through permission-keys.ts → category + minimum. */
export async function requirePermission(
  supabase: AnySupabase,
  userId: string,
  organizationId: string,
  perm: string,
): Promise<MemberAccess> {
  const access = await requireOrgMembership(supabase, userId, organizationId);
  if (!hasPermission(access.categories, perm)) throw new Error(`Forbidden: missing permission ${perm}`);
  return access;
}

export async function requireAnyPermission(
  supabase: AnySupabase,
  userId: string,
  organizationId: string,
  perms: string[],
): Promise<MemberAccess> {
  const access = await requireOrgMembership(supabase, userId, organizationId);
  if (!perms.some((p) => hasPermission(access.categories, p))) {
    throw new Error(`Forbidden: missing one of [${perms.join(", ")}]`);
  }
  return access;
}
