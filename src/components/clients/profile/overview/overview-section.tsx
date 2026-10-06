// Client Overview: needs-attention cards (click → section), units left per
// code with today's pace, must-knows, coming up, team and the last notes.
// Draws getClientOverview as it is; no counting here.

import type { ClientOverview } from "@/lib/clients/overview";
import type { ClientProfileSection } from "@/lib/clients/profile-sections";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { AttentionCards } from "./attention-cards";
import { MustKnowsCard } from "./must-knows-card";
import { ComingUpCard, LastNotesCard, TeamCard } from "./overview-lists";
import { UnitsCard } from "./units-card";

export function OverviewSection({
  orgId,
  data,
  overview,
  loading,
  error,
  onSelect,
}: {
  orgId: string;
  data: ClientProfileData;
  overview: ClientOverview | null;
  loading: boolean;
  error: boolean;
  onSelect: (section: ClientProfileSection) => void;
}) {
  return (
    <div className="space-y-4" data-testid="client-section-overview">
      {error ? (
        <p className="text-sm text-destructive">Couldn't load the overview. Please try again.</p>
      ) : (
        <AttentionCards items={overview?.attention ?? []} loading={loading} onSelect={onSelect} />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <MustKnowsCard
          orgId={orgId}
          clientId={data.client.id}
          text={data.client.special_directions}
        />
        <UnitsCard paces={overview?.paces ?? []} loading={loading} />
        <ComingUpCard items={overview?.comingUp ?? []} onSelect={onSelect} />
        <TeamCard team={overview?.team ?? []} onSelect={onSelect} />
      </div>
      <LastNotesCard notes={overview?.lastNotes ?? []} onSelect={onSelect} />
    </div>
  );
}
