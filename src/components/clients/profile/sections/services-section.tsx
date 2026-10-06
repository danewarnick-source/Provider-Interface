// Services & billing: authorizations (the 1056) with units used vs. left,
// pace, dollars and rate history; Fill from 1056; and the monthly budget.
// Needs Billing: View; changes need Billing: Edit.

import { useAccess } from "@/hooks/use-access";
import { AuthorizationsCard } from "@/components/clients/profile/services/authorizations-card";
import { MonthlyBudget } from "@/components/clients/profile/services/monthly-budget";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

export function ServicesSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const canEdit = useAccess().canCategory("billing", "edit");
  return (
    <div className="space-y-4" data-testid="client-section-services">
      <AuthorizationsCard orgId={orgId} clientId={data.client.id} canEdit={canEdit} />
      <MonthlyBudget clientId={data.client.id} clientName={data.name} />
    </div>
  );
}
