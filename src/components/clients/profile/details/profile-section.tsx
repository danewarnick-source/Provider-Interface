// Profile section: identity, photo (date taken, 5-year warning), service
// address with the clock-in pin and geofence, extra service locations,
// mailing address, About me and More details (custom fields).

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
    <div className="space-y-4" data-testid="client-section-profile">
      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
        <IdentityCard key={clientId} orgId={orgId} data={data} onChanged={onChanged} />
        <div className="space-y-4">
          <ClientPhotoCard clientId={clientId} />
          <TextFieldCard
            orgId={orgId}
            clientId={clientId}
            field="about_me"
            title="About me"
            subtitle="What matters to them, in their words where possible."
            value={data.client.about_me}
            empty="Nothing written yet."
            rows={5}
            onChanged={onChanged}
          />
        </div>
      </div>
      <section aria-label="Service address" className="space-y-2">
        <h2 className="text-sm font-semibold">Service address</h2>
        <p className="text-xs text-muted-foreground">
          Where services happen. Staff clock in within the circle around the pin.
        </p>
        <HomePinCard clientId={clientId} />
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ServiceLocationsCard orgId={orgId} clientId={clientId} />
        <TextFieldCard
          orgId={orgId}
          clientId={clientId}
          field="mailing_address"
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
