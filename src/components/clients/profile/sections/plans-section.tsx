// Plans (rebuilt in a later step): plan goals and supports, authorized
// codes, support strategies, progress summaries and rights restrictions.

import { useAccess } from "@/hooks/use-access";
import { PlanGoalsPanel } from "@/components/clients/profile/plans/plan-goals-panel";
import { AuthorizedCodesCard } from "@/components/clients/profile/plans/authorized-codes-card";
import { SupportStrategiesPanel } from "@/components/clients/profile/plans/support-strategies-panel";
import { SummariesPanel } from "@/components/clients/profile/plans/summaries-panel";
import { RightsRestrictionsPanel } from "@/components/clients/profile/plans/rights-restrictions-panel";
import { HrcSectionCard } from "@/components/clients/profile/cards/hrc-section-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

export function PlansSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const canHrc = useAccess().canCategory("hrc");
  const clientId = data.client.id;
  return (
    <div className="space-y-4" data-testid="client-section-plans">
      <div className="grid gap-4 md:grid-cols-2">
        <PlanGoalsPanel clientId={clientId} orgId={orgId} codes={data.codes} />
        <AuthorizedCodesCard clientId={clientId} codes={data.codes} />
      </div>
      <SupportStrategiesPanel clientId={clientId} orgId={orgId} />
      <SummariesPanel clientId={clientId} orgId={orgId} codes={data.codes} />
      {canHrc ? (
        <>
          <HrcSectionCard orgId={orgId} client={data.client} />
          <RightsRestrictionsPanel clientId={clientId} />
        </>
      ) : null}
    </div>
  );
}
