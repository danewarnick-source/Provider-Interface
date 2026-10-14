import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IncidentReportDialog } from "@/components/incidents/incident-report-dialog";
import { isTakenStatus } from "@/lib/medications/dose-status";
import {
  clockTime,
  isLateDose,
  isPrnOverride,
  type GiveLog,
  type GiveMed,
} from "@/lib/medications/give-meds";
import { nameWithStrength } from "@/lib/medications/med-display";
import { doseTrainingMark } from "@/lib/medications/med-training";

function statusLabel(log: GiveLog): string {
  if (isTakenStatus(log.status)) return "Given";
  return log.exception_reason ? `Not given: ${log.exception_reason}` : "Not given";
}

/** Today's charted doses, each with "Wrong or missed dose?". */
export function LoggedDoses({
  clientId,
  logs,
  meds,
  onReported,
}: {
  clientId: string;
  logs: readonly GiveLog[];
  meds: readonly GiveMed[];
  onReported: () => void;
}) {
  const [report, setReport] = useState<{ logId: string | null } | null>(null);
  const medById = new Map(meds.map((m) => [m.id, m]));

  return (
    <div>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing logged yet today.</p>
      ) : (
        <ul className="divide-y">
          {logs.map((l) => {
            const med = l.medication_id ? medById.get(l.medication_id) : undefined;
            const taken = isTakenStatus(l.status);
            const mark = doseTrainingMark(l);
            return (
              <li
                key={l.id}
                className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {med ? nameWithStrength(med) : "Medication"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabel(l)}
                    {taken
                      ? ` at ${clockTime(l.actual_taken_at ?? l.administered_at ?? l.scheduled_for)}`
                      : ""}
                    {l.staff_name ? ` · ${l.staff_name}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {isLateDose(l) ? (
                      <Badge variant="outline" className="text-[10px]">
                        Late
                      </Badge>
                    ) : null}
                    {isPrnOverride(l) ? (
                      <Badge variant="outline" className="text-[10px]">
                        Past PRN limit
                      </Badge>
                    ) : null}
                    {mark ? (
                      <Badge variant="outline" className="border-amber-400 text-[10px]">
                        {mark}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto self-start p-0 text-xs text-rose-700"
                  onClick={() => setReport({ logId: l.id })}
                >
                  Wrong or missed dose?
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        type="button"
        variant="link"
        className="mt-1 h-auto p-0 text-xs text-rose-700"
        onClick={() => setReport({ logId: null })}
      >
        Report a medication error for a dose not listed
      </Button>
      <IncidentReportDialog
        open={!!report}
        onOpenChange={(o) => !o && setReport(null)}
        clientId={clientId}
        defaultCategory="Medication error"
        emarLogId={report?.logId ?? null}
        onSubmitted={() => {
          setReport(null);
          onReported();
        }}
      />
    </div>
  );
}
