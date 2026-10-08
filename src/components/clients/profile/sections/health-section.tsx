// Health: the header (Log a health event, four tiles), allergies /
// diagnoses / conditions, then cards in pairs: Medications | Recent health
// events, Care needs | Absences (RHS clients), Diet and swallowing |
// Advance directive. Cards the setup answers hide (support-scope.ts) are
// left out, with "Show hidden sections" below. Must-knows live on Overview.
// Needs Client medical: View; edits need Client medical: Edit.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { directiveStatus, showsAbsences } from "@/lib/clients/health";
import { cardShows, hiddenCards, type ScopeFacts } from "@/lib/clients/support-scope";
import { HealthHeader } from "@/components/clients/profile/health/health-header";
import { MedicalListsCard } from "@/components/clients/profile/health/medical-lists-card";
import { MedicationsCard } from "@/components/clients/profile/health/medications-card";
import { CareNeedsCard } from "@/components/clients/profile/health/care-needs-card";
import { DietCard } from "@/components/clients/profile/health/diet-card";
import { AdvanceDirectiveCard } from "@/components/clients/profile/health/advance-directive-card";
import { HealthEventsCard } from "@/components/clients/profile/health/health-events-card";
import { AbsencesCard } from "@/components/clients/profile/health/absences-card";
import {
  useCanEditMedical,
  useClientHealth,
} from "@/components/clients/profile/health/use-client-health";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";
import { HiddenSections } from "@/components/clients/profile/setup/hidden-sections";
import { useSupportScope } from "@/components/clients/profile/setup/use-support-scope";

/** Two columns; an odd last card spans both so no column sits empty. */
const PAIRS = "grid gap-5 md:grid-cols-2 md:[&>*:last-child:nth-child(odd)]:col-span-2";

export function HealthSection({
  orgId,
  data,
  onOpenProfile,
}: {
  orgId: string;
  data: ClientProfileData;
  onOpenProfile: () => void;
}) {
  const clientId = data.client.id;
  const health = useClientHealth(orgId, clientId);
  const canEdit = useCanEditMedical();
  const [logging, setLogging] = useState(false);
  const h = health.data ?? null;
  const scope = useSupportScope(clientId).data ?? null;
  const status = h ? (directiveStatus(h.dnr_status) ?? (h.polst_status ? "polst" : null)) : null;
  const facts: ScopeFacts = { needsBsp: false, directiveOnFile: status === "dnr" || status === "polst" };
  const shows = (card: "medications" | "health_events" | "advance_directive") =>
    cardShows(card, scope, facts);
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-health">
      <HealthHeader
        clientId={clientId}
        firstName={data.client.first_name?.trim() || data.name}
        health={h}
        canEdit={canEdit}
        onLog={shows("health_events") ? () => setLogging(true) : undefined}
        onOpenProfile={onOpenProfile}
        directiveShown={shows("advance_directive")}
      />
      {health.isLoading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : !h ? (
        <p className="text-sm text-muted-foreground">Health details couldn't be loaded.</p>
      ) : (
        <MedicalListsCard orgId={orgId} health={h} />
      )}
      <div className={PAIRS}>
        {h && shows("medications") ? <MedicationsCard health={h} clientName={data.name} /> : null}
        {shows("health_events") ? (
          <HealthEventsCard
            orgId={orgId}
            clientId={clientId}
            logging={logging}
            onLog={() => setLogging(true)}
            onDone={() => setLogging(false)}
          />
        ) : null}
        {h ? <CareNeedsCard orgId={orgId} health={h} /> : null}
        {showsAbsences(data.codes) ? <AbsencesCard orgId={orgId} clientId={clientId} /> : null}
        {h ? <DietCard orgId={orgId} health={h} /> : null}
        {h && shows("advance_directive") ? <AdvanceDirectiveCard orgId={orgId} health={h} /> : null}
      </div>
      <HiddenSections orgId={orgId} clientId={clientId} cards={hiddenCards("health", scope, facts)} />
    </div>
  );
}
