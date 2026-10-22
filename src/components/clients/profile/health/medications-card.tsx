// Medications: allergies and swallowing risk (read-only here; edited in the
// Health cards), how the client takes their medications, Add medication and
// Print medication list, then two tabs: Medications and MAR. A link to
// #health-mar opens the MAR tab. Spans both columns of the Health grid.

import { useState } from "react";
import { Pill, Printer, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { medicationSupportSummary } from "@/lib/clients/health/health";
import type { ClientHealthRow } from "./use-client-health";
import { MedicationsTab } from "./medications/medications-tab";
import { MedicationFormSheet } from "./medications/medication-form-sheet";
import { MarTab } from "./medications/mar-tab";
import {
  useClientMedications,
  usePrintMedicationList,
  type ClientMedication,
} from "./medications/use-medications";

function swallowingRisk(h: ClientHealthRow): string | null {
  const alerts = (h.swallowing_alerts ?? []).filter(Boolean);
  if (alerts.length) return alerts.join(", ");
  return h.dysphagia ? "Swallowing risk" : null;
}

export function MedicationsCard({
  health,
  canEdit,
}: {
  health: ClientHealthRow;
  canEdit: boolean;
}) {
  const clientId = health.id;
  const meds = useClientMedications(clientId);
  const print = usePrintMedicationList(clientId);
  const [form, setForm] = useState<{ med: ClientMedication | null } | null>(null);
  const [tab, setTab] = useState(() =>
    typeof window !== "undefined" && window.location.hash === "#health-mar" ? "mar" : "medications",
  );
  const allergies = (health.allergies ?? []).filter(Boolean);
  const swallow = swallowingRisk(health);
  const list = meds.data ?? [];

  return (
    <SectionCard
      id="health-medications"
      icon={Pill}
      tone="danger"
      title="Medications"
      description="Staff support the person to take their own medications. Nurses give medications only under PM or PN codes."
      className="md:col-span-2"
      testId="client-medications-card"
      actions={
        <>
          {canEdit ? (
            <Button onClick={() => setForm({ med: null })} data-testid="med-add">
              <Plus className="mr-1 h-4 w-4" /> Add medication
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => print.mutate()} disabled={print.isPending}>
            <Printer className="mr-1 h-4 w-4" />
            {print.isPending ? "Building…" : "Print medication list"}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <StatusTag tone={allergies.length ? "danger" : "neutral"}>
          Allergies: {allergies.length ? allergies.join(", ") : "none on file"}
        </StatusTag>
        <StatusTag tone={swallow ? "danger" : "neutral"}>
          {swallow ? `Swallowing: ${swallow}` : "No swallowing risk on file"}
        </StatusTag>
        <span className="text-xs text-muted-foreground">{medicationSupportSummary(list)}</span>
      </div>
      <span id="health-mar" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="mar">MAR</TabsTrigger>
        </TabsList>
        <TabsContent value="medications" className="mt-4">
          <MedicationsTab
            clientId={clientId}
            meds={list}
            loading={meds.isLoading}
            canEdit={canEdit}
            onAdd={() => setForm({ med: null })}
            onEdit={(med) => setForm({ med })}
          />
        </TabsContent>
        <TabsContent value="mar" className="mt-4">
          <MarTab clientId={clientId} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
      {canEdit ? (
        <MedicationFormSheet
          clientId={clientId}
          medication={form?.med ?? null}
          open={!!form}
          onClose={() => setForm(null)}
        />
      ) : null}
    </SectionCard>
  );
}
