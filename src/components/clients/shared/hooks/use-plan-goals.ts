import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { isRouteUuid } from "@/lib/route-uuid";
import { loadActiveCodes } from "@/lib/clients/codes";
import {
  currentPlan,
  goalSupportOptions,
  goalView,
  goalsOn,
  supportsForCode,
  type ClientPlanBundle,
} from "@/lib/clients/plans";
import { loadPlanBundle } from "@/lib/clients/plans-load";
import { addClientPlan, endClientGoal, saveClientGoal } from "@/lib/clients/plans.functions";

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
 * The current plan's active goals, plus quick add / end. A goal added here
 * gets one blank support listing the client's active codes, so every team
 * member working those codes sees it until supports are written.
 */
export function useCurrentPlanGoals(clientId: string) {
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const plansQ = useClientPlans(clientId);
  const addPlanFn = useServerFn(addClientPlan);
  const saveGoalFn = useServerFn(saveClientGoal);
  const endGoalFn = useServerFn(endClientGoal);

  const plan = currentPlan(plansQ.data?.plans ?? []);
  const goals = plan ? (plansQ.data?.goals ?? []).filter((g) => g.plan_id === plan.id && g.status === "active") : [];
  const scope = () => {
    if (!org?.organization_id) throw new Error("No organization selected.");
    return { organizationId: org.organization_id, clientId };
  };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: clientPlansKey(clientId) });
    qc.invalidateQueries({ queryKey: ["client-readiness", clientId] });
    qc.invalidateQueries({ queryKey: ["client-care-data", clientId] });
  };

  const addGoal = useMutation({
    mutationFn: async (goalText: string) => {
      const s = scope();
      const planId = plan?.id ?? (await addPlanFn({ data: s })).id;
      const codes = (await loadActiveCodes(supabase, [clientId])).get(clientId) ?? [];
      await saveGoalFn({ data: { ...s, planId, goal: { goal_text: goalText }, supportCodes: codes } });
    },
    onSuccess: refresh,
  });
  const endGoal = useMutation({
    mutationFn: async (goalId: string) => endGoalFn({ data: { ...scope(), goalId } }),
    onSuccess: refresh,
  });

  return { plansQ, plan, goals, addGoal, endGoal };
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
