// The MAR tab: pick a month (opens on this month), the month's summary,
// print or save the PDF, sign off the month, the grid and its key.
// Clicking a logged cell opens the dose.

import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/medications/mar-month";
import { summaryLine } from "@/lib/medications/mar-cells";
import { MAR_KEY, MarGridTable } from "./mar-grid-table";
import { MarDoseSheet } from "./mar-dose-sheet";
import { MarSignOff } from "./mar-signoff";
import { useMarMonth, usePrintMar } from "./use-mar";

export function MarTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const [month, setMonth] = useState(() => currentMonth());
  const [open, setOpen] = useState<string[] | null>(null);
  const mar = useMarMonth(clientId, month);
  const print = usePrintMar(clientId, month);
  const thisMonth = currentMonth();

  return (
    <div className="space-y-3" data-testid="mar-tab">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            aria-label="Previous month"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-36 text-center font-medium" data-testid="mar-month">
            {monthLabel(month)}
          </span>
          <Button
            size="icon"
            variant="outline"
            aria-label="Next month"
            disabled={month >= thisMonth}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {month !== thisMonth ? (
            <Button size="sm" variant="ghost" onClick={() => setMonth(thisMonth)}>
              This month
            </Button>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => print.mutate()} disabled={print.isPending}>
          <Printer className="mr-1 h-4 w-4" />
          {print.isPending ? "Building…" : "Print MAR"}
        </Button>
      </div>

      {mar.isLoading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : mar.error ? (
        <p className="text-sm text-destructive">{(mar.error as Error).message}</p>
      ) : mar.data ? (
        <>
          <p className="text-sm" data-testid="mar-summary">
            {summaryLine(mar.data.grid.summary)}
          </p>
          <MarSignOff clientId={clientId} data={mar.data} canEdit={canEdit} />
          <MarGridTable data={mar.data} onOpenDose={setOpen} />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {MAR_KEY.map(([kind, label]) => (
              <li key={kind}>{label}</li>
            ))}
            <li>* Late entry (documented over an hour after it was taken)</li>
            <li>! Medication error</li>
            <li># Given by staff without current med training</li>
          </ul>
          <MarDoseSheet
            data={mar.data}
            logIds={open}
            canEdit={canEdit}
            clientId={clientId}
            onClose={() => setOpen(null)}
          />
        </>
      ) : null}
    </div>
  );
}
