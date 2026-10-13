// Services & billing: the header card, one card per open authorization (the
// 1056) with units used vs. left and pace, and past authorizations with Renew.
// Needs Billing: View; changes need Billing: Edit.

import { useAccess } from "@/hooks/use-access";
import { Authorizations } from "@/components/clients/profile/services/authorizations";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

export function ServicesSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const canEdit = useAccess().canCategory("billing", "edit");
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-services">
      <Authorizations
        orgId={orgId}
        clientId={data.client.id}
        clientName={data.name}
        canEdit={canEdit}
      />
    </div>
  );
}
