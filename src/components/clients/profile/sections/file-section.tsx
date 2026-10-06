// Client file (rebuilt in a later step): one card per required document,
// the documents the client's codes add, and host-home certifications.

import { ClientFileTab } from "@/components/clients/profile/client-file-tab";
import { CodeDocuments } from "@/components/clients/profile/cards/code-documents";
import { HostHomeCertPanel } from "@/components/clients/profile/file/host-home-cert-panel";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { clientFeatureVisible } from "@/lib/clients/features";

export function FileSection({
  orgId,
  data,
  onOpenFiles,
}: {
  orgId: string;
  data: ClientProfileData;
  onOpenFiles: () => void;
}) {
  const hostHome = clientFeatureVisible(
    { feature_config: data.client.feature_config, codes: data.codes },
    "host_home",
  );
  return (
    <div className="space-y-4" data-testid="client-section-file">
      <ClientFileTab organizationId={orgId} clientId={data.client.id} clientName={data.name} />
      <CodeDocuments orgId={orgId} data={data} onOpenFiles={onOpenFiles} />
      {hostHome ? <HostHomeCertPanel clientId={data.client.id} orgId={orgId} /> : null}
    </div>
  );
}
