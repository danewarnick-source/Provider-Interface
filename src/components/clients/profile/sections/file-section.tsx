// Client file: every required document with status, due and expiry dates
// (upload / replace / archive, never delete), the belongings inventory, the
// documents a client's codes add, host-home certifications, and all
// documents on file.

import { useAccess } from "@/hooks/use-access";
import { BelongingsInventoryCard } from "@/components/clients/profile/belongings-inventory-card";
import { CodeDocuments } from "@/components/clients/profile/cards/code-documents";
import { HostHomeCertPanel } from "@/components/clients/profile/file/host-home-cert-panel";
import { RequiredDocumentsCard } from "@/components/clients/profile/file/required-documents-card";
import { ClientDocumentsCard } from "@/components/clients/shared/client-documents-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { clientFeatureVisible } from "@/lib/clients/features";
import { BELONGINGS_CODES, codesHas } from "@/lib/clients/file";

export function FileSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const canEdit = useAccess().canCategory("clients", "edit");
  const clientId = data.client.id;
  const hostHome = clientFeatureVisible(
    { feature_config: data.client.feature_config, codes: data.codes },
    "host_home",
  );
  return (
    <div className="space-y-4" data-testid="client-section-file">
      <RequiredDocumentsCard orgId={orgId} clientId={clientId} canEdit={canEdit} />
      {codesHas(data.codes, BELONGINGS_CODES) && (
        <BelongingsInventoryCard clientId={clientId} clientName={data.name} />
      )}
      <CodeDocuments orgId={orgId} data={data} />
      {hostHome ? <HostHomeCertPanel clientId={clientId} orgId={orgId} /> : null}
      <ClientDocumentsCard clientId={clientId} clientName={data.name} />
    </div>
  );
}
