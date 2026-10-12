// Medications: how much help the client needs with medications, the link to
// the eMAR board, and the client's medications and eMAR on demand.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { medicationSupportLabel } from "@/lib/clients/health";
import { MarEmarTab } from "@/components/workspace/mar-emar-tab";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { Field, FieldGrid } from "@/components/clients/profile/cards/card-parts";
import type { ClientHealthRow } from "./use-client-health";

export function MedicationsCard({
  health,
  clientName,
}: {
  health: ClientHealthRow;
  clientName: string;
}) {
  const [showMeds, setShowMeds] = useState(false);
  return (
    <SectionCard
      id="health-medications"
      icon={Pill}
      tone="danger"
      title="Medications"
      description="How much help they need with medications. Doses are given and charted on the eMAR."
      className={showMeds ? "md:col-span-2" : undefined}
      actions={
        <Button variant="outline" asChild>
          <Link to="/dashboard/emar">Open eMAR board</Link>
        </Button>
      }
    >
      <FieldGrid>
        <Field label="Medication support" wide>
          {medicationSupportLabel(health.self_admin_med_support)}
        </Field>
      </FieldGrid>
      <Button
        variant="outline"
        className="mt-4"
        onClick={() => setShowMeds((v) => !v)}
        data-testid="client-meds-toggle"
      >
        {showMeds ? "Hide medications" : "Show medications"}
      </Button>
      {showMeds ? (
        <div className="pt-3">
          <MarEmarTab clientId={health.id} clientName={clientName} />
        </div>
      ) : null}
    </SectionCard>
  );
}
