// Profile section: "About <first name>" (lead, full width), then Identity |
// Service address side by side, extra service locations | mailing address,
// and More details (custom fields). The photo lives in the header.

import { Mail } from "lucide-react";
import { HomePinCard } from "@/components/clients/profile/home-pin-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { AboutCard } from "./about-card";
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
      <AboutCard
        orgId={orgId}
        clientId={clientId}
        firstName={data.client.first_name?.trim() ?? ""}
        agencyNotes={data.client.about_me}
        onChanged={onChanged}
      />
      <div className="grid items-stretch gap-5 md:grid-cols-2 [&>*]:h-full">
        <IdentityCard key={clientId} orgId={orgId} data={data} onChanged={onChanged} />
        <HomePinCard clientId={clientId} codes={data.codes} />
      </div>
      <div className="grid items-stretch gap-5 md:grid-cols-2 [&>*]:h-full">
        <ServiceLocationsCard orgId={orgId} clientId={clientId} codes={data.codes} />
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
