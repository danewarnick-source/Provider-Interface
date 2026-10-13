// Who may call the Knowledge base library server functions (N3, Standard Rules).
//
// Every call: signed in, an active member of the agency, and the agency has
// `nectar` on (the one feature key). Admin library actions also need
// agency_settings view (reads) or edit (writes) and agency-wide scope.
// "Mark as reviewed" and a team member's own policies need only an active
// membership, checked here on the server. Library calls make no model call,
// so no AI setting applies to them; publishing makes embeddings only while
// Nectar and Ask are on, charged to the agency's rate limit (index.server.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireOrgMembership } from "@/integrations/supabase/require-org";
import { isAgencyAdmin } from "@/lib/access/levels";
import type { MemberAccess } from "@/lib/access/member";
import { requireCategory } from "@/lib/access/require";
import { requireNectarOrg, type NectarContext } from "@/lib/nectar/engine/guard.server";

type Db = SupabaseClient<Database>;

export type LibraryCaller = { db: Db; userId: string; orgId: string; access: MemberAccess };

export const LIBRARY_SIGNED_OUT = "Sign in to use the Knowledge base.";
export const LIBRARY_ADMIN_ONLY =
  "Only an owner or an agency-wide admin can manage the Knowledge base.";

function signedIn(context: NectarContext): { db: Db; userId: string } {
  if (!context.supabase || !context.userId) throw new Error(LIBRARY_SIGNED_OUT);
  return { db: context.supabase, userId: context.userId };
}

/** Owner or agency-wide admin with agency_settings at `min`, in an agency with Nectar on. */
export async function requireLibraryAdmin(
  context: NectarContext,
  orgId: string,
  min: "view" | "edit",
): Promise<LibraryCaller> {
  const { db, userId } = signedIn(context);
  await requireNectarOrg(context, { orgId, feature: null });
  const access = await requireCategory(db, userId, orgId, "agency_settings", min);
  if (!isAgencyAdmin(access.level, access.scope)) throw new Error(LIBRARY_ADMIN_ONLY);
  return { db, userId, orgId, access };
}

/** Any active member of an agency with Nectar on. */
export async function requireLibraryMember(
  context: NectarContext,
  orgId: string,
): Promise<LibraryCaller> {
  const { db, userId } = signedIn(context);
  await requireNectarOrg(context, { orgId, feature: null });
  const access = await requireOrgMembership(db, userId, orgId);
  return { db, userId, orgId, access };
}
