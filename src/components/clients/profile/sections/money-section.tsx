// Money (only for clients with PBA, loans or spending; needs Billing: View):
// the header with balance / this month / open loans tiles, the PBA ledger
// and quarterly audit, the spending log, then loans (owners only).
// Changes need Billing: Edit.

import { useState } from "react";
import { useAccess } from "@/hooks/use-access";
import { useCurrentOrg } from "@/hooks/use-org";
import { MoneyHeader } from "@/components/clients/profile/money/money-header";
import { PbaCard } from "@/components/clients/profile/money/pba-card";
import { LoansCard } from "@/components/clients/profile/money/loans-card";
import { SpendingCard } from "@/components/clients/profile/money/spending-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

export function MoneySection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const { canCategory, isOwner } = useAccess();
  const { data: org } = useCurrentOrg();
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const clientId = data.client.id;
  const canEdit = canCategory("billing", "edit");
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-money">
      <MoneyHeader
        orgId={orgId}
        clientId={clientId}
        canEdit={canEdit}
        isOwner={isOwner}
        onAddTransaction={() => setLedgerOpen(true)}
      />
      <PbaCard
        orgId={orgId}
        clientId={clientId}
        clientName={data.name}
        canEdit={canEdit}
        ledgerOpen={ledgerOpen}
        onLedgerOpenChange={setLedgerOpen}
      />
      <SpendingCard orgId={orgId} clientId={clientId} />
      {isOwner ? (
        <LoansCard
          orgId={orgId}
          orgName={org?.organization_name ?? "Provider"}
          clientId={clientId}
          clientName={data.name}
        />
      ) : null}
    </div>
  );
}
