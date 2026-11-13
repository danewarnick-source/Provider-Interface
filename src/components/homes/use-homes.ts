// Data for Settings › Homes: who can see and change homes (home-setup.ts
// homesAccess, the same rule the server applies), the list, one home, and the
// refresh after a change. Homes feed Clients, the scheduler and Finances, so a
// change also refreshes their home lists.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAccess } from "@/hooks/use-access";
import { useCurrentOrg } from "@/hooks/use-org";
import { homesAccess } from "@/lib/homes/home-setup";
import { getHome, getHomes } from "@/lib/homes/homes.functions";

export function useHomesAccess() {
  const a = useAccess();
  const { data: org } = useCurrentOrg();
  const scheduling = a.canCategory("scheduling", "edit")
    ? "edit"
    : a.canCategory("scheduling", "view")
      ? "view"
      : "off";
  return {
    orgId: org?.organization_id ?? null,
    isLoading: a.isLoading,
    ...homesAccess({ level: a.level, scope: a.scope, scheduling }),
  };
}

const LIST_KEY = "settings-homes";
const HOME_KEY = "settings-home";
/** Other screens' home lists (clients, scheduler, team members). */
const RELATED_KEYS = ["org-homes", "scheduler-board", "client-profile", "clients"];

export function useHomeList(orgId: string | null, enabled: boolean) {
  const fn = useServerFn(getHomes);
  return useQuery({
    queryKey: [LIST_KEY, orgId],
    enabled: !!orgId && enabled,
    queryFn: () => fn({ data: { organizationId: orgId! } }),
  });
}

export function useHome(orgId: string | null, teamId: string, enabled: boolean) {
  const fn = useServerFn(getHome);
  return useQuery({
    queryKey: [HOME_KEY, teamId],
    enabled: !!orgId && enabled,
    queryFn: () => fn({ data: { organizationId: orgId!, teamId } }),
  });
}

export function useRefreshHomes() {
  const qc = useQueryClient();
  return () => {
    for (const key of [LIST_KEY, HOME_KEY, ...RELATED_KEYS])
      void qc.invalidateQueries({ queryKey: [key] });
  };
}
