// Server-side gate for anything done to a client. Callers run this first,
// before any write. The rules live in ./guards.ts (pure, unit-tested); this
// file only supplies the real data sources.

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCategory } from "@/lib/access/require";
import { DISCHARGED_STATUSES } from "./list/list";
import {
  CLIENT_NOT_FOUND_MESSAGE,
  friendlyGuardError,
  runManageClientGuard,
  type ManageClientAction,
} from "./guards";

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
        loadClient: async (id) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase as any)
            .from("clients")
            .select("organization_id, account_status, deleted_at")
            .eq("id", id)
            .maybeSingle();
          if (error) throw new Error(error.message);
          const row = data as {
            organization_id: string;
            account_status: string | null;
            deleted_at: string | null;
          } | null;
          if (!row) return null;
          return {
            organizationId: row.organization_id,
            discharged: (DISCHARGED_STATUSES as readonly string[]).includes(
              row.account_status ?? "",
            ),
            deleted: row.deleted_at != null,
          };
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

/**
 * For server fns that only get a client id: resolve the client's agency
 * (it must match `organizationId` when the caller sends one), then run the
 * full guard there. Returns that agency.
 */
export async function assertCanManageClientById(args: {
  supabase: AnySupabase;
  actorId: string;
  clientId: string;
  action: ManageClientAction;
  organizationId?: string | null;
}): Promise<string> {
  const { supabase, actorId, clientId, action } = args;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("clients")
    .select("organization_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const orgId = (data as { organization_id: string } | null)?.organization_id;
  if (!orgId || (args.organizationId && args.organizationId !== orgId)) {
    throw new Error(CLIENT_NOT_FOUND_MESSAGE);
  }
  await assertCanManageClient({ supabase, actorId, organizationId: orgId, clientId, action });
  return orgId;
}
