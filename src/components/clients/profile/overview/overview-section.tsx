// Client Overview: the collapsed "Needs attention (N)" button, the support
// strategies "Sent to …" line once sent, must-knows
// (lead, full width), then Units left | Coming up, then Team | Last notes.
// Draws getClientOverview as it is; no counting here.

import type { ClientOverview } from "@/lib/clients/overview";
import { sentLine } from "@/lib/clients/strategy-sends";
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
    <div className="flex flex-col gap-5" data-testid="client-section-overview">
      {error ? (
        <p className="text-sm text-destructive">Couldn't load the overview. Please try again.</p>
      ) : (
        <AttentionCards items={overview?.attention ?? []} loading={loading} onSelect={onSelect} />
      )}
      {overview?.strategies.kind === "sent" ? (
        <button
          type="button"
          className="self-start text-left text-sm text-muted-foreground hover:underline"
          onClick={() => onSelect("plans")}
          data-testid="overview-strategies-sent"
        >
          Support strategies: {sentLine(overview.strategies)}
        </button>
      ) : null}
      <MustKnowsCard
        orgId={orgId}
        clientId={data.client.id}
        text={data.client.special_directions}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <UnitsCard
          paces={overview?.paces ?? []}
          loading={loading}
          onOpenServices={() => onSelect("services")}
        />
        <ComingUpCard items={overview?.comingUp ?? []} onSelect={onSelect} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <TeamCard team={overview?.team ?? []} onSelect={onSelect} />
        <LastNotesCard notes={overview?.lastNotes ?? []} onSelect={onSelect} />
      </div>
    </div>
  );
}
