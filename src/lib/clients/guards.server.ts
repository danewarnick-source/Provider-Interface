// Server-side gate for anything done to a client. Callers run this first,
// before any write. The rules live in ./guards.ts (pure, unit-tested); this
// file only supplies the real data sources.

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCategory } from "@/lib/access/require";
import { friendlyGuardError, runManageClientGuard, type ManageClientAction } from "./guards";

export type { ManageClientAction } from "./guards";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any> | SupabaseClient;

export async function assertCanManageClient(args: {
  supabase: AnySupabase;
  actorId: string;
  organizationId: string;
  clientId?: string | null;
  action: ManageClientAction;
}): Promise<void> {
  const { supabase, actorId, organizationId, clientId, action } = args;
  try {
    await runManageClientGuard(
      { actorId, organizationId, clientId, action },
      {
        requireCategory: async (category, min) => {
          const access = await requireCategory(supabase, actorId, organizationId, category, min);
          return { level: access.level, scope: access.scope };
        },
        loadClientOrg: async (id) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase as any)
            .from("clients")
            .select("organization_id")
            .eq("id", id)
            .maybeSingle();
          if (error) throw new Error(error.message);
          return (data as { organization_id: string } | null)?.organization_id ?? null;
        },
        canSeeClient: async (id) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase as any).rpc("access_can_see_client", {
            _client: id,
            _user: actorId,
          });
          if (error) throw new Error(error.message);
          return data === true;
        },
      },
    );
  } catch (err) {
    throw friendlyGuardError(err);
  }
}
