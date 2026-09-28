import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEntitlements } from "@/lib/financial/entitlements.functions";
import { useAuth } from "@/hooks/use-auth";
import type { AddonId, TierId } from "@/lib/hive-exec/hive-tiers";

/**
 * Single source of truth for tier + add-on entitlements in the UI.
 *
 * Drives the visible-but-locked pattern across PI: components ask
 * `hasAddon("internal_audit")` and render the AddonLock when it's false.
 * Server functions must independently enforce the same check
 * (see `assertAddonForOrg` / `assertMemberPlanAddon` in
 * `entitlements.server.ts`) — the UI lock and the server check must agree.
 * Team-member Nectar follows the org plan. A browser flag cannot add it.
 */
export function useEntitlements() {
  const { session } = useAuth();
  const fn = useServerFn(getMyEntitlements);

  const q = useQuery({
    queryKey: ["my-entitlements", session?.user?.id ?? "anon"],
    enabled: !!session?.user?.id,
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  const addons = (q.data?.addons ?? []) as AddonId[];

  const tier = (q.data?.tier ?? "starter") as TierId;

  return {
    tier,
    status: q.data?.status ?? "trial",
    addons,
    loading: q.isLoading,
    hasAddon: (id: AddonId) => addons.includes(id),
  };
}
