// Real reads behind guard.ts, on the request's own data client (RLS applies
// in Supabase-auth mode; every read here also filters by the caller).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  checkNectarCaller,
  nectarOrgIdsFrom,
  nectarRefusal,
  NECTAR_FEATURE_KEY,
  type NectarCallerCheck,
  type NectarCallerDeps,
} from "./guard";

type Db = SupabaseClient<Database>;

/** The server-fn context from requireSupabaseAuth (empty during SSR). */
export type NectarContext = { supabase?: Db | null; userId?: string | null };

export function nectarCallerDeps(supabase: Db): NectarCallerDeps {
  return {
    loadActiveOrgIds: async (userId) => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .eq("active", true);
      if (error) throw new Error("Could not check your agency membership.");
      return (data ?? []).map((row) => row.organization_id);
    },
    loadNectarOrgIds: async (orgIds) => {
      const [registry, overrides] = await Promise.all([
        supabase
          .from("feature_registry")
          .select("default_enabled")
          .eq("feature_key", NECTAR_FEATURE_KEY)
          .maybeSingle(),
        supabase
          .from("organization_features")
          .select("organization_id, enabled")
          .eq("feature_key", NECTAR_FEATURE_KEY)
          .in("organization_id", orgIds),
      ]);
      if (registry.error || overrides.error) {
        throw new Error("Could not check whether Nectar is on for your agency.");
      }
      return nectarOrgIdsFrom(orgIds, registry.data?.default_enabled, overrides.data ?? []);
    },
  };
}

/** Signed in + active member + `nectar` on. Never throws for a refusal. */
export function nectarCaller(
  context: NectarContext,
  opts: { orgId?: string } = {},
): Promise<NectarCallerCheck> {
  const { supabase, userId } = context;
  if (!supabase || !userId) return Promise.resolve(nectarRefusal("signed_out"));
  return checkNectarCaller(userId, nectarCallerDeps(supabase), opts);
}

/** nectarCaller that throws the refusal message. Returns the agency id. */
export async function requireNectarOrg(
  context: NectarContext,
  opts: { orgId?: string } = {},
): Promise<string> {
  const check = await nectarCaller(context, opts);
  if (!check.ok) throw new Error(check.message);
  return check.orgId;
}
