// Health (rebuilt in a later step): health at a glance and medications /
// eMAR — the same record staff use on shift. Needs Client medical: View.

import { MarEmarTab } from "@/components/workspace/mar-emar-tab";
import { AtGlanceCard } from "@/components/clients/profile/cards/at-glance-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

export function HealthSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  return (
    <div className="space-y-4" data-testid="client-section-health">
      <AtGlanceCard orgId={orgId} client={data.client} />
      <MarEmarTab clientId={data.client.id} clientName={data.name} />
    </div>
  );
}
