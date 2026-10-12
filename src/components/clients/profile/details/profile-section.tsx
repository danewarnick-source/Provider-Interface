// Profile section: "About <first name>" (lead, full width), then Identity |
// Service address side by side, extra service locations, and More details
// (custom fields). The photo lives in the header; "Person prefers no photo"
// (setup) is listed under "Show hidden sections".

import { HomePinCard } from "@/components/clients/profile/home-pin-card";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { HiddenSections } from "@/components/clients/profile/setup/hidden-sections";
import { useSupportScope } from "@/components/clients/profile/setup/use-support-scope";
import { hiddenCards } from "@/lib/clients/support-scope";
import { AboutCard } from "./about-card";
import { IdentityCard } from "./identity-card";
import { MoreDetailsCard } from "./more-details-card";
import { ServiceLocationsCard } from "./service-locations-card";

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
  const scope = useSupportScope(clientId).data ?? null;
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
      <ServiceLocationsCard orgId={orgId} clientId={clientId} codes={data.codes} />
      <MoreDetailsCard clientId={clientId} />
      <HiddenSections orgId={orgId} clientId={clientId} cards={hiddenCards("profile", scope)} />
    </div>
  );
}
