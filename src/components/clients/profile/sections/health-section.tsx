// Health: must-knows, allergies / diagnoses / chronic conditions,
// swallowing, advance directive, emergency treatment authorization and
// medication support (with the eMAR), the health events log, and absences
// for RHS clients. Needs Client medical: View; edits need Client medical: Edit.

import { Loader2 } from "lucide-react";
import { showsAbsences } from "@/lib/clients/health";
import { MustKnowsCard } from "@/components/clients/profile/overview/must-knows-card";
import { MedicalListsCard } from "@/components/clients/profile/health/medical-lists-card";
import { SwallowingCard } from "@/components/clients/profile/health/swallowing-card";
import { AdvanceDirectiveCard } from "@/components/clients/profile/health/advance-directive-card";
import { CareCard } from "@/components/clients/profile/health/care-card";
import { HealthEventsCard } from "@/components/clients/profile/health/health-events-card";
import { AbsencesCard } from "@/components/clients/profile/health/absences-card";
import { useClientHealth } from "@/components/clients/profile/health/use-client-health";
import type { ClientProfileData } from "@/components/clients/profile/use-client-profile";

export function HealthSection({ orgId, data }: { orgId: string; data: ClientProfileData }) {
  const clientId = data.client.id;
  const health = useClientHealth(orgId, clientId);
  return (
    <div className="flex flex-col gap-5" data-testid="client-section-health">
      <MustKnowsCard orgId={orgId} clientId={clientId} text={data.client.special_directions} />
      {health.isLoading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : health.data ? (
        <>
          <MedicalListsCard orgId={orgId} health={health.data} />
          <div className="grid gap-5 md:grid-cols-2">
            <SwallowingCard orgId={orgId} health={health.data} />
            <AdvanceDirectiveCard orgId={orgId} health={health.data} />
          </div>
          <CareCard orgId={orgId} health={health.data} clientName={data.name} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Health details couldn't be loaded.</p>
      )}
      <HealthEventsCard orgId={orgId} clientId={clientId} />
      {showsAbsences(data.codes) ? <AbsencesCard orgId={orgId} clientId={clientId} /> : null}
    </div>
  );
}
