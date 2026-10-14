// The Medications tab: one card per active medication (first time of day
// first, PRNs last), then "Show stopped medications (N)" for paused and
// stopped ones with their reason. Opens the form, status, send and history.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import { splitByStatus } from "@/lib/medications/med-display";
import { MedicationItem, type MedAction } from "./medication-item";
import { HistorySheet } from "./history-sheet";
import { SendDialog, StatusDialog, type StatusAction } from "./status-dialogs";
import type { ClientMedication } from "./use-medications";

export function MedicationsTab({
  clientId,
  meds,
  loading,
  canEdit,
  onAdd,
  onEdit,
}: {
  clientId: string;
  meds: ClientMedication[];
  loading: boolean;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (med: ClientMedication) => void;
}) {
  const [showStopped, setShowStopped] = useState(false);
  const [status, setStatus] = useState<{ med: ClientMedication; action: StatusAction } | null>(
    null,
  );
  const [sending, setSending] = useState<ClientMedication | null>(null);
  const [history, setHistory] = useState<ClientMedication | null>(null);
  const { active, inactive } = splitByStatus(meds);

  const act = (action: MedAction, med: ClientMedication) => {
    if (action === "edit") onEdit(med);
    else if (action === "send") setSending(med);
    else if (action === "history") setHistory(med);
    else setStatus({ med, action });
  };

  if (loading)
    return (
      <p className="text-sm text-muted-foreground">
        <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading…
      </p>
    );

  return (
    <div className="space-y-3" data-testid="med-list">
      {active.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {active.map((m) => (
            <MedicationItem key={m.id} med={m} canEdit={canEdit} onAction={act} />
          ))}
        </div>
      ) : (
        <EmptyState action={canEdit ? <Button onClick={onAdd}>Add medication</Button> : undefined}>
          No active medications on file.
        </EmptyState>
      )}
      {inactive.length ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowStopped((s) => !s)}
          data-testid="med-show-stopped"
        >
          {showStopped ? "Hide" : "Show"} stopped medications ({inactive.length})
        </Button>
      ) : null}
      {showStopped ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {inactive.map((m) => (
            <MedicationItem key={m.id} med={m} canEdit={canEdit} onAction={act} />
          ))}
        </div>
      ) : null}
      <StatusDialog
        clientId={clientId}
        medication={status?.med ?? null}
        action={status?.action ?? "pause"}
        onClose={() => setStatus(null)}
      />
      <SendDialog clientId={clientId} medication={sending} onClose={() => setSending(null)} />
      <HistorySheet medication={history} onClose={() => setHistory(null)} />
    </div>
  );
}
