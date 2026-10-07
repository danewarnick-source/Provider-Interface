// Services & billing: the header card, one card per open authorization (the
// 1056) with units used vs. left and pace, past authorizations with Renew,
// and the monthly budget full width under them.
// Needs Billing: View; changes need Billing: Edit.

import { useAccess } from "@/hooks/use-access";
import { Authorizations } from "@/components/clients/profile/services/authorizations";
import { MonthlyBudget } from "@/components/clients/profile/services/monthly-budget";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

export function ServicesSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const canEdit = useAccess().canCategory("billing", "edit");
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-services">
      <Authorizations orgId={orgId} clientId={data.client.id} canEdit={canEdit} />
      <MonthlyBudget clientId={data.client.id} clientName={data.name} />
    </div>
  );
}
