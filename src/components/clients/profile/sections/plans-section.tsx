// Plans, top to bottom: Plan years (the PCSP sets the dates) → Goals and
// supports → Support strategies (one per support paid to the agency) →
// Progress summaries → rights restrictions (the single HRC editor) and the
// behavior support plan (BC1–BC3 clients, or a Yes in the setup; a No hides
// it, with "Show hidden sections" below).

import { useAccess } from "@/hooks/use-access";
import { needsBehaviorSupportPlan } from "@/lib/clients/bsp";
import { todayYmd } from "@/lib/clients/dates";
import { activeGoalViewsOn, goalsOn } from "@/lib/clients/plans";
import { agencySupports } from "@/lib/clients/support-strategies";
import { cardShows, hiddenCards } from "@/lib/clients/support-scope";
import { useClientPlans } from "@/components/clients/shared/hooks/use-plan-goals";
import { PlanYearsCard } from "@/components/clients/profile/plans/plan-years-card";
import { PlanGoalsPanel } from "@/components/clients/profile/plans/plan-goals-panel";
import { SupportStrategiesPanel } from "@/components/clients/profile/plans/support-strategies-panel";
import { SummariesPanel } from "@/components/clients/profile/plans/summaries-panel";
import { RestrictionsCard } from "@/components/clients/profile/plans/restrictions-card";
import { BspCard } from "@/components/clients/profile/plans/bsp-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { HiddenSections } from "@/components/clients/profile/setup/hidden-sections";
import { useSupportScope } from "@/components/clients/profile/setup/use-support-scope";

export function PlansSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const access = useAccess();
  const clientId = data.client.id;
  const bundle = useClientPlans(clientId).data;
  const plans = bundle?.plans ?? [];
  const today = todayYmd();
  const current = goalsOn(bundle, today);
  const goalViews = activeGoalViewsOn(bundle, today);
  const supports = agencySupports(goalViews);
  const canEdit = access.canCategory("clients", "edit");
  const scope = useSupportScope(clientId).data ?? null;
  const facts = { needsBsp: needsBehaviorSupportPlan(data.codes, current.goals), directiveOnFile: false };
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-plans">
      <PlanYearsCard
        orgId={orgId}
        clientId={clientId}
        plans={plans}
        planCodes={[...new Set(supports.flatMap((s) => s.codes))]}
        canEdit={canEdit}
      />
      <PlanGoalsPanel clientId={clientId} orgId={orgId} codes={data.codes} canEdit={canEdit} />
      <SupportStrategiesPanel
        clientId={clientId}
        orgId={orgId}
        plan={current.plan}
        supports={supports}
        canEdit={access.isAdminLevel}
      />
      <SummariesPanel clientId={clientId} clientName={data.name} orgId={orgId} codes={data.codes} />
      {access.canCategory("hrc") ? <RestrictionsCard orgId={orgId} data={data} /> : null}
      {cardShows("bsp", scope, facts) ? (
        <BspCard orgId={orgId} clientId={clientId} required={facts.needsBsp} />
      ) : null}
      <HiddenSections orgId={orgId} clientId={clientId} cards={hiddenCards("plans", scope, facts)} />
    </div>
  );
}
