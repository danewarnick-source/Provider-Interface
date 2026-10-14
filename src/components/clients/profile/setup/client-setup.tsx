// The profile's "Finish setting up" banner and its steps, for people who can
// edit clients. The steps open from the banner or from Add client
// (?setup=open); closing them leaves the banner until setup is finished.

import { useAccess } from "@/hooks/use-access";
import { setupPending } from "@/lib/clients/support-scope";
import type { ClientOverview } from "@/lib/clients/overview";
import type { ClientProfileSection } from "@/lib/clients/profile-sections";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { ClientSetupDialog } from "./client-setup-dialog";
import { SetupBanner } from "./setup-banner";
import { useSupportScope } from "./use-support-scope";

export function ClientSetup({
  orgId,
  data,
  overview,
  open,
  discharged,
  onOpenChange,
  onSelect,
  onDraftAbout,
}: {
  orgId: string;
  data: ClientProfileData;
  overview: ClientOverview | null;
  open: boolean;
  discharged: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (section: ClientProfileSection) => void;
  onDraftAbout: () => void;
}) {
  const canEdit = useAccess().canCategory("clients", "edit");
  const scope = useSupportScope(data.client.id).data ?? null;
  if (!canEdit || discharged) return null;
  return (
    <>
      {setupPending(scope) ? (
        <SetupBanner
          firstName={data.client.first_name?.trim() || data.name}
          onOpen={() => onOpenChange(true)}
        />
      ) : null}
      <ClientSetupDialog
        open={open}
        orgId={orgId}
        data={data}
        overview={overview}
        onClose={() => onOpenChange(false)}
        onOpenSection={onSelect}
        onDraftAbout={onDraftAbout}
      />
    </>
  );
}
