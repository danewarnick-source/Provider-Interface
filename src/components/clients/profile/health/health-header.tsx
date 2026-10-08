// The Health header: purpose, "Log a health event", and four tiles
// (Allergies, Diet and swallowing, Mobility, Emergency plan), each with
// one line of detail and a link to its card.

import { HeartPulse, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientCareData } from "@/hooks/use-client-care-data";
import {
  allergyTile,
  dietTile,
  emergencyPlanTile,
  mobilityTile,
  type HealthTile,
} from "@/lib/clients/health-tiles";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { InfoTile } from "@/components/clients/profile/cards/card-parts";
import type { ClientHealthRow } from "./use-client-health";

const scrollTo = (id: string) => () =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export function HealthHeader({
  clientId,
  firstName,
  health,
  canEdit,
  onLog,
  onOpenProfile,
  directiveShown,
}: {
  clientId: string;
  firstName: string;
  health: ClientHealthRow | null;
  canEdit: boolean;
  /** Undefined when health events are hidden (family handles doctor visits). */
  onLog?: () => void;
  onOpenProfile: () => void;
  /** False when the setup answers hide the advance directive card. */
  directiveShown: boolean;
}) {
  const care = useClientCareData(clientId);
  const custom = (key: string) =>
    care.data?.custom_fields.find((f) => f.field_key === key)?.value?.value_text ?? null;
  const tile = (label: string, t: HealthTile, link?: { label: string; onClick: () => void }) => (
    <InfoTile label={label} value={t.value} note={t.note} warn={t.warn} link={link} />
  );
  return (
    <SectionCard
      icon={HeartPulse}
      tone="danger"
      title="Health"
      description={`What staff need to keep ${firstName} safe.`}
      testId="client-health-header"
      actions={
        canEdit && onLog ? (
          <Button onClick={onLog}>
            <Plus className="h-4 w-4" /> Log a health event
          </Button>
        ) : null
      }
    >
      {health ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tile("Allergies", allergyTile(health.allergies), {
            label: "See allergies",
            onClick: scrollTo("health-conditions"),
          })}
          {tile(
            "Diet",
            dietTile({
              dysphagia: health.dysphagia,
              swallowingAlerts: health.swallowing_alerts,
              diet: custom("dietary_restrictions"),
            }),
            { label: "See diet", onClick: scrollTo("health-diet") },
          )}
          {tile(
            "Mobility",
            mobilityTile({
              mobility: custom("mobility_notes"),
              equipment: custom("adaptive_equipment"),
            }),
            { label: "Edit in Profile", onClick: onOpenProfile },
          )}
          {tile(
            "Emergency plan",
            emergencyPlanTile({
              dnrStatus: health.dnr_status,
              polstStatus: health.polst_status,
              treatmentAuthorization: health.emergency_medical_treatment_authorization,
            }),
            directiveShown
              ? { label: "See advance directive", onClick: scrollTo("health-directive") }
              : undefined,
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}
