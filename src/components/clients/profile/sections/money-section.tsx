// Money (only for clients with PBA, loans or spending; needs Billing: View):
// the PBA trust ledger and quarterly audit, loans (owners only) and the
// spending log. Changes need Billing: Edit.

import { useAccess } from "@/hooks/use-access";
import { useCurrentOrg } from "@/hooks/use-org";
import { PbaCard } from "@/components/clients/profile/money/pba-card";
import { LoansCard } from "@/components/clients/profile/money/loans-card";
import { SpendingCard } from "@/components/clients/profile/money/spending-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

export function MoneySection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const { canCategory, isOwner } = useAccess();
  const { data: org } = useCurrentOrg();
  const clientId = data.client.id;
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-money">
      <PbaCard
        orgId={orgId}
        clientId={clientId}
        clientName={data.name}
        canEdit={canCategory("billing", "edit")}
      />
      {isOwner ? (
        <LoansCard
          orgId={orgId}
          orgName={org?.organization_name ?? "Provider"}
          clientId={clientId}
          clientName={data.name}
        />
      ) : null}
      <SpendingCard orgId={orgId} clientId={clientId} />
    </div>
  );
}
