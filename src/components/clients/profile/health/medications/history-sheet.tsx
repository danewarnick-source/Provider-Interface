// One medication's change history: who, when, what changed and why.

import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { describeChanges } from "@/lib/medications/med-history";
import { useMedicationChanges, type ClientMedication } from "./use-medications";

const ACTION: Record<string, string> = {
  add: "Added",
  edit: "Edited",
  pause: "Paused",
  resume: "Resumed",
  stop: "Stopped",
  send: "Sent with client",
};

export function HistorySheet({
  medication,
  onClose,
}: {
  medication: ClientMedication | null;
  onClose: () => void;
}) {
  const changes = useMedicationChanges(medication?.id ?? null);
  return (
    <Sheet open={!!medication} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="med-history-sheet">
        <SheetHeader>
          <SheetTitle>History: {medication?.medication_name}</SheetTitle>
        </SheetHeader>
        {changes.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : !changes.data?.length ? (
          <p className="mt-4 text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {changes.data.map((c) => (
              <li key={c.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {ACTION[c.action] ?? c.action} · {c.changed_by_name || "A team member"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.changed_at).toLocaleString()}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {describeChanges(c.changes).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {c.reason ? <p className="mt-1 text-xs">Reason: {c.reason}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
}
