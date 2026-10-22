// The Health header: purpose, "Log a health event", and four tiles
// (Allergies, Diet and swallowing, Mobility, Emergency plan), each with
// one line of detail and a link to the card below that edits it.

import { HeartPulse, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  allergyTile,
  dietTile,
  emergencyPlanTile,
  mobilityTile,
  type HealthTile,
} from "@/lib/clients/health/health-tiles";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { InfoTile } from "@/components/clients/profile/cards/card-parts";
import type { ClientHealthRow } from "./use-client-health";

const scrollTo = (id: string) => () =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export function HealthHeader({
  firstName,
  health,
  canEdit,
  onLog,
}: {
  firstName: string;
  health: ClientHealthRow | null;
  canEdit: boolean;
  /** Undefined when health events are hidden (family handles doctor visits). */
  onLog?: () => void;
}) {
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
              diets: health.diets,
            }),
            { label: "See diet", onClick: scrollTo("health-diet") },
          )}
          {tile("Mobility", mobilityTile(health.mobility), {
            label: "See mobility",
            onClick: scrollTo("health-mobility"),
          })}
          {tile(
            "Emergency plan",
            emergencyPlanTile({
              plan: health.emergency_plan,
              dnrStatus: health.dnr_status,
              polstStatus: health.polst_status,
            }),
            { label: "See emergency plan", onClick: scrollTo("health-emergency-plan") },
          )}
        </div>
      ) : null}
    </SectionCard>
  );
}
