// Hooks for a client's plan years, goals and supports (client_plans,
// client_goals and client_goal_supports).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isRouteUuid } from "@/lib/route-uuid";
import {
  goalSupportOptions,
  goalView,
  goalsOn,
  supportsForCode,
  type ClientPlanBundle,
} from "@/lib/clients/plans/plans";
import { loadPlanBundle } from "@/lib/clients/plans/plans-load";

export const clientPlansKey = (clientId: string | undefined) => ["client-plans", clientId] as const;

/** Every plan year for a client with goals and supports (RLS-scoped read). */
export function useClientPlans(clientId: string | undefined) {
  return useQuery({
    enabled: isRouteUuid(clientId),
    queryKey: clientPlansKey(clientId),
    queryFn: (): Promise<ClientPlanBundle> => loadPlanBundle(supabase, clientId!),
  });
}

/**
 * The supports for one code on a date (plan in effect that day), grouped by
 * goal, plus flat checkable rows. For notes: host-home daily logs etc.
 */
export function useSupportsForCode(clientId: string | undefined, code: string | null | undefined, date: string) {
  const plansQ = useClientPlans(clientId);
  const groups = supportsForCode(goalsOn(plansQ.data, date).goals, code, date).map((g) => goalView(g.goal, g.supports));
  return { groups, options: goalSupportOptions(groups), isLoading: plansQ.isLoading };
}
