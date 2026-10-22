// The "Meds" item in the clock-out check: doses due during the shift must be
// logged before clock-out.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GiveMeds } from "./give-meds";
import { useGiveMeds } from "./use-give-meds";

/**
 * The clock-out check's "Meds" item. Doses due during the shift (clock-in to
 * now) must be logged, given or not given, before clock-out; Give meds opens
 * right here. A PRN follow-up still due is a reminder, not a block.
 */
export function ClockOutMeds({
  clientId,
  clientName,
  clockInIso,
  serviceContext,
  onResolvedChange,
}: {
  clientId: string;
  clientName: string;
  clockInIso: string;
  serviceContext?: string | null;
  onResolvedChange: (resolved: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  // "Now" is captured on mount and each time Give meds opens: the parent
  // re-renders every second for its timer, which must not change the query.
  const [windowEnd, setWindowEnd] = useState(() => new Date().toISOString());
  const window = useMemo(() => ({ start: clockInIso, end: windowEnd }), [clockInIso, windowEnd]);
  // Same query as the Give meds dialog, so logging a dose updates this check.
  const g = useGiveMeds(clientId, undefined, window);
  const status = {
    loading: g.loading,
    dueByNow: g.dueByNow.length,
    followupsDue: g.followups.length,
  };

  useEffect(() => {
    onResolvedChange(!status.loading && status.dueByNow === 0);
  }, [status.loading, status.dueByNow, onResolvedChange]);

  const done = !status.loading && status.dueByNow === 0;
  return (
    <div className="rounded-lg border border-border bg-white/60 px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          {done ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Pill className="h-4 w-4 text-amber-600" />
          )}
          Meds
        </div>
        <Button
          type="button"
          size="sm"
          variant={done ? "outline" : "default"}
          onClick={() => {
            setWindowEnd(new Date().toISOString());
            setOpen(true);
          }}
        >
          Give meds
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {g.error
          ? `Couldn't check doses: ${g.error.message}`
          : status.loading
            ? "Checking doses…"
            : status.dueByNow > 0
              ? `${status.dueByNow} dose${status.dueByNow === 1 ? "" : "s"} due this shift still to log (given or not given).`
              : "Every dose due this shift is logged."}
      </p>
      {status.followupsDue > 0 ? (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Reminder: {status.followupsDue} PRN follow-up{status.followupsDue === 1 ? "" : "s"} due.
          Record whether it helped.
        </p>
      ) : null}
      <Link
        to="/dashboard/workspace/$clientId"
        params={{ clientId }}
        search={{ tab: "emar" }}
        className="mt-1 inline-block text-xs underline"
      >
        Open {clientName}'s MAR tab
      </Link>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Give meds: {clientName}</DialogTitle>
          </DialogHeader>
          <GiveMeds
            clientId={clientId}
            window={window}
            serviceContext={serviceContext}
            showLogged={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
