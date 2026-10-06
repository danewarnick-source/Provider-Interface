// Plans: plan years (with 60/30-day reminders and the waiting count), plan
// goals → supports with "View as" a code, support strategies (due 30 days
// after the plan is activated), progress summaries for every code that owes
// one, rights restrictions (the single HRC editor) and, for BC1–BC3
// clients, the behavior support plan.

import { useAccess } from "@/hooks/use-access";
import { needsBehaviorSupportPlan } from "@/lib/clients/bsp";
import { strategiesDueOn } from "@/lib/clients/plan-dates";
import { currentPlan } from "@/lib/clients/plans";
import { useClientPlans } from "@/components/clients/shared/hooks/use-plan-goals";
import { PlanYearsCard } from "@/components/clients/profile/plans/plan-years-card";
import { PlanGoalsPanel } from "@/components/clients/profile/plans/plan-goals-panel";
import { SupportStrategiesPanel } from "@/components/clients/profile/plans/support-strategies-panel";
import { SummariesPanel } from "@/components/clients/profile/plans/summaries-panel";
import { RestrictionsCard } from "@/components/clients/profile/plans/restrictions-card";
import { BspCard } from "@/components/clients/profile/plans/bsp-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

export function PlansSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const access = useAccess();
  const clientId = data.client.id;
  const bundle = useClientPlans(clientId).data;
  const plans = bundle?.plans ?? [];
  const current = currentPlan(plans);
  const currentGoals = (bundle?.goals ?? []).filter((g) => g.plan_id === current?.id);
  return (
    <div className="space-y-4" data-testid="client-section-plans">
      <PlanYearsCard orgId={orgId} clientId={clientId} plans={plans} canEdit={access.canCategory("clients", "edit")} />
      <PlanGoalsPanel clientId={clientId} orgId={orgId} codes={data.codes} />
      <SupportStrategiesPanel clientId={clientId} orgId={orgId} dueOn={strategiesDueOn(current)} />
      <SummariesPanel clientId={clientId} orgId={orgId} codes={data.codes} />
      {access.canCategory("hrc") ? <RestrictionsCard orgId={orgId} data={data} /> : null}
      {needsBehaviorSupportPlan(data.codes, currentGoals) ? <BspCard orgId={orgId} clientId={clientId} /> : null}
    </div>
  );
}
