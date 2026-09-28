// Server-side gate for anything one team member does to another. Callers run
// this first, before any write. The rules themselves live in ./guards.ts
// (pure, unit-tested); this file only supplies the real data sources.
//
// Reads organization_members.access_level / access_scope only — never the
// legacy `role` column.

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCategory } from "@/lib/access/require";
import { runManageMemberGuard, type ManageMemberAction } from "./guards";

export type { ManageMemberAction } from "./guards";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any> | SupabaseClient;

export async function assertCanManageMember(args: {
  supabase: AnySupabase;
  actorId: string;
  organizationId: string;
  targetUserId?: string | null;
  action: ManageMemberAction;
}): Promise<void> {
  const { supabase, actorId, organizationId, targetUserId, action } = args;
  await runManageMemberGuard(
    { actorId, targetUserId, action },
    {
      requireCategory: async (category, min) => {
        const access = await requireCategory(supabase, actorId, organizationId, category, min);
        return { level: access.level, scope: access.scope };
      },
      canSeeStaff: async (staffId) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc("access_can_see_staff", {
          _org: organizationId,
          _staff: staffId,
          _viewer: actorId,
        });
        if (error) throw new Error(error.message);
        return data === true;
      },
      loadTargetLevel: async (staffId) => {
        // Any membership row proves same-org; no `active` filter, because
        // reactivate and reset password legitimately act on deactivated members.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("organization_members")
          .select("access_level")
          .eq("organization_id", organizationId)
          .eq("user_id", staffId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return null;
        return (data as { access_level: string | null }).access_level ?? "staff";
      },
    },
  );
}
