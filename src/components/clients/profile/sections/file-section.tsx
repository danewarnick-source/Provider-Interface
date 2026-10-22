// Client file: the client's documents from Evidence (one record with the
// Evidence page), grouped by pack, plus the belongings inventory, the
// documents a client's codes add, host-home certifications (linked to the
// host's record), and all documents on file.

import { useAccess } from "@/hooks/use-access";
import { BelongingsInventoryCard } from "@/components/clients/profile/belongings-inventory-card";
import { CodeDocuments } from "@/components/clients/profile/cards/code-documents";
import { ClientFileDocuments } from "@/components/clients/profile/file/client-file-documents";
import { HostHomeCertPanel } from "@/components/clients/profile/file/host-home-cert-panel";
import { ClientDocumentsCard } from "@/components/clients/shared/client-documents-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { clientFeatureVisible } from "@/lib/clients/features";
import { BELONGINGS_CODES, codesHas } from "@/lib/clients/file";

export function FileSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const { canCategory, isAgencyAdmin } = useAccess();
  const canEdit = canCategory("clients", "edit");
  const clientId = data.client.id;
  const hostHome = clientFeatureVisible(
    { feature_config: data.client.feature_config, codes: data.codes },
    "host_home",
  );
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-file">
      <ClientFileDocuments
        orgId={orgId}
        clientId={clientId}
        clientName={data.name}
        firstName={data.client.first_name?.trim() || data.name}
        canEdit={canEdit}
        canManage={canEdit && isAgencyAdmin}
      />
      {codesHas(data.codes, BELONGINGS_CODES) && (
        <BelongingsInventoryCard clientId={clientId} clientName={data.name} />
      )}
      <CodeDocuments orgId={orgId} data={data} />
      {hostHome ? <HostHomeCertPanel clientId={clientId} orgId={orgId} /> : null}
      <ClientDocumentsCard clientId={clientId} clientName={data.name} />
    </div>
  );
}
