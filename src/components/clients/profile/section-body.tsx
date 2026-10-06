// Draws the active client profile section.

import type { ClientOverview } from "@/lib/clients/overview";
import type { ClientProfileSection } from "@/lib/clients/profile-sections";
import { OverviewSection } from "./overview/overview-section";
import { ProfileSection } from "./details/profile-section";
import { ContactsSection } from "./contacts/contacts-section";
import { HealthSection } from "./sections/health-section";
import { PlansSection } from "./sections/plans-section";
import { ServicesSection } from "./sections/services-section";
import { FileSection } from "./sections/file-section";
import { TeamSection } from "./sections/team-section";
import { ActivitySection } from "./sections/activity-section";
import type { ClientProfileData } from "./use-client-profile";

export function SectionBody({
  section,
  orgId,
  data,
  overview,
  overviewLoading,
  overviewError,
  onSelect,
  onChanged,
}: {
  section: ClientProfileSection;
  orgId: string;
  data: ClientProfileData;
  overview: ClientOverview | null;
  overviewLoading: boolean;
  overviewError: boolean;
  onSelect: (section: ClientProfileSection) => void;
  onChanged: () => void;
}) {
  const clientId = data.client.id;
  switch (section) {
    case "overview":
      return (
        <OverviewSection
          orgId={orgId}
          data={data}
          overview={overview}
          loading={overviewLoading}
          error={overviewError}
          onSelect={onSelect}
        />
      );
    case "profile":
      return <ProfileSection orgId={orgId} data={data} onChanged={onChanged} />;
    case "contacts":
      return <ContactsSection orgId={orgId} data={data} />;
    case "health":
      return <HealthSection orgId={orgId} data={data} />;
    case "plans":
      return <PlansSection orgId={orgId} data={data} />;
    case "services":
      return <ServicesSection orgId={orgId} data={data} />;
    case "file":
      return <FileSection orgId={orgId} data={data} />;
    case "team":
      return <TeamSection clientId={clientId} />;
    case "activity":
      return <ActivitySection clientId={clientId} orgId={orgId} />;
  }
}
