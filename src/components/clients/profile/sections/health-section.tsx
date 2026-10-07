// Health: the header (Log a health event, four tiles), allergies /
// diagnoses / conditions, then cards in pairs: Medications | Recent health
// events, Care needs | Absences (RHS clients), Swallowing | Advance
// directive. Must-knows live on Overview. Needs Client medical: View;
// edits need Client medical: Edit.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { showsAbsences } from "@/lib/clients/health";
import { HealthHeader } from "@/components/clients/profile/health/health-header";
import { MedicalListsCard } from "@/components/clients/profile/health/medical-lists-card";
import { MedicationsCard } from "@/components/clients/profile/health/medications-card";
import { CareNeedsCard } from "@/components/clients/profile/health/care-needs-card";
import { SwallowingCard } from "@/components/clients/profile/health/swallowing-card";
import { AdvanceDirectiveCard } from "@/components/clients/profile/health/advance-directive-card";
import { HealthEventsCard } from "@/components/clients/profile/health/health-events-card";
import { AbsencesCard } from "@/components/clients/profile/health/absences-card";
import {
  useCanEditMedical,
  useClientHealth,
} from "@/components/clients/profile/health/use-client-health";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

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
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-health">
      <HealthHeader
        clientId={clientId}
        firstName={data.client.first_name?.trim() || data.name}
        health={h}
        canEdit={canEdit}
        onLog={() => setLogging(true)}
        onOpenProfile={onOpenProfile}
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
        {h ? <MedicationsCard health={h} clientName={data.name} /> : null}
        <HealthEventsCard
          orgId={orgId}
          clientId={clientId}
          logging={logging}
          onLog={() => setLogging(true)}
          onDone={() => setLogging(false)}
        />
        {h ? <CareNeedsCard orgId={orgId} health={h} /> : null}
        {showsAbsences(data.codes) ? <AbsencesCard orgId={orgId} clientId={clientId} /> : null}
        {h ? <SwallowingCard orgId={orgId} health={h} /> : null}
        {h ? <AdvanceDirectiveCard orgId={orgId} health={h} /> : null}
      </div>
    </div>
  );
}
