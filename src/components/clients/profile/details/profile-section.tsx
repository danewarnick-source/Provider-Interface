// Profile section: identity (lead card), photo + About me, the service
// address with the clock-in pin and geofence, extra service locations +
// mailing address, and More details (custom fields).

import { Mail, Smile } from "lucide-react";
import { ClientPhotoCard } from "@/components/clients/profile/client-photo-card";
import { HomePinCard } from "@/components/clients/profile/home-pin-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { IdentityCard } from "./identity-card";
import { MoreDetailsCard } from "./more-details-card";
import { ServiceLocationsCard } from "./service-locations-card";
import { TextFieldCard } from "./text-field-card";

export function ProfileSection({
  orgId,
  data,
  onChanged,
}: {
  orgId: string;
  data: ClientProfileData;
  onChanged: () => void;
}) {
  const clientId = data.client.id;
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-profile">
      <IdentityCard key={clientId} orgId={orgId} data={data} onChanged={onChanged} />
      <div className="grid gap-5 md:grid-cols-2">
        <ClientPhotoCard clientId={clientId} />
        <TextFieldCard
          orgId={orgId}
          clientId={clientId}
          field="about_me"
          icon={Smile}
          title="About me"
          subtitle="What matters to them, in their words where possible."
          value={data.client.about_me}
          empty="Nothing written yet."
          rows={5}
          onChanged={onChanged}
        />
      </div>
      <HomePinCard clientId={clientId} />
      <div className="grid gap-5 md:grid-cols-2">
        <ServiceLocationsCard orgId={orgId} clientId={clientId} />
        <TextFieldCard
          orgId={orgId}
          clientId={clientId}
          field="mailing_address"
          icon={Mail}
          title="Mailing address"
          subtitle="Only if mail goes somewhere other than the service address."
          value={data.client.mailing_address}
          empty="Same as the service address."
          onChanged={onChanged}
        />
      </div>
      <MoreDetailsCard clientId={clientId} />
    </div>
  );
}
