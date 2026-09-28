import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  BehaviorObservationsBlock,
  type BehaviorAnswers,
} from "@/components/evv/behavior-observations-block";
import { BehaviorObservationsBoundary } from "@/components/evv/behavior-observations-boundary";
import { IncidentReportDialog } from "@/components/incidents/incident-report-dialog";
import {
  ShiftMedDueCheck,
  type PendingMedDose,
} from "@/components/medications/shift-med-due-check";
import { NoteTriggerPrompt } from "@/components/residential/note-trigger-prompt";
import { selectedPill, unselectedPill } from "@/components/evv/toggle-styles";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface PunchPadShiftSignalsProps {
  shiftId: string;
  clientId: string;
  clientName: string;
  organizationId?: string;
  clockInIso: string;
  narrative: string;
  incidentAnswer: "yes" | "no" | null;
  incidentReportIds: string[];
  incidentDialogOpen: boolean;
  incidentTriggerOpen: boolean;
  behaviorEnabled: boolean;
  behaviorAnswers: BehaviorAnswers;
  targetBehaviorOptions: string[];
  onIncidentAnswer: (answer: "yes" | "no") => void;
  onIncidentDialogOpenChange: (open: boolean) => void;
  onIncidentTriggerOpenChange: (open: boolean) => void;
  onIncidentSubmitted: (reportId: string) => void;
  onAppointmentTriggered: () => void;
  onTriggersResolved: (resolved: boolean) => void;
  onBehaviorChange: (answers: BehaviorAnswers) => void;
  onMedResolvedChange: (resolved: boolean) => void;
  onPendingDosesChange: (pending: PendingMedDose[]) => void;
}

export function PunchPadShiftSignals({
  shiftId,
  clientId,
  clientName,
  organizationId,
  clockInIso,
  narrative,
  incidentAnswer,
  incidentReportIds,
  incidentDialogOpen,
  incidentTriggerOpen,
  behaviorEnabled,
  behaviorAnswers,
  targetBehaviorOptions,
  onIncidentAnswer,
  onIncidentDialogOpenChange,
  onIncidentTriggerOpenChange,
  onIncidentSubmitted,
  onAppointmentTriggered,
  onTriggersResolved,
  onBehaviorChange,
  onMedResolvedChange,
  onPendingDosesChange,
}: PunchPadShiftSignalsProps) {
  return (
    <>
      <div className="grid gap-2 rounded-md border border-border bg-muted/40 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium">
            Did anything happen this shift that needs an incident report?
          </span>
          {incidentReportIds.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-3 w-3" />
              Incident report filed
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={incidentReportIds.length > 0}
            onClick={() => {
              onIncidentAnswer("no");
              onIncidentDialogOpenChange(false);
            }}
            className={`min-h-[44px] rounded-md border px-3 py-2 text-xs font-medium ${
              incidentAnswer === "no" ? selectedPill : unselectedPill
            }`}
          >
            No
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onIncidentAnswer("yes");
              onIncidentDialogOpenChange(true);
            }}
            className={`min-h-[44px] rounded-md border px-3 py-2 text-xs font-medium ${
              incidentAnswer === "yes" || incidentReportIds.length > 0
                ? selectedPill
                : unselectedPill
            }`}
          >
            {incidentReportIds.length > 0 ? "Add another report" : "Yes"}
          </Button>
        </div>
        {incidentAnswer === "yes" && incidentReportIds.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Submit the incident report before you can submit the timesheet.
          </p>
        )}
      </div>

      <NoteTriggerPrompt
        text={narrative}
        clientId={clientId}
        date={new Date().toISOString().slice(0, 10)}
        onOpenForm={(kind) => {
          if (kind === "incident") {
            onIncidentTriggerOpenChange(true);
            onIncidentDialogOpenChange(true);
            return;
          }
          onAppointmentTriggered();
        }}
        onAllResolved={onTriggersResolved}
      />

      <IncidentReportDialog
        open={incidentDialogOpen}
        onOpenChange={(open) => {
          onIncidentDialogOpenChange(open);
          if (!open) onIncidentTriggerOpenChange(false);
        }}
        clientId={clientId}
        triggeredByNoteId={shiftId}
        triggeredByNoteType={incidentTriggerOpen ? "evv_timesheet" : null}
        onSubmitted={onIncidentSubmitted}
      />

      {behaviorEnabled && (
        <BehaviorObservationsBoundary answersSnapshot={behaviorAnswers}>
          <BehaviorObservationsBlock
            value={behaviorAnswers}
            onChange={onBehaviorChange}
            targetBehaviorOptions={targetBehaviorOptions}
            onOpenIncident={() => onIncidentDialogOpenChange(true)}
          />
        </BehaviorObservationsBoundary>
      )}

      {organizationId && (
        <ShiftMedDueCheckSlot
          organizationId={organizationId}
          clientId={clientId}
          clientName={clientName}
          clockInIso={clockInIso}
          emarHref={`/dashboard/workspace/${clientId}?tab=mar-emar`}
          onResolvedChange={onMedResolvedChange}
          onPendingDosesChange={onPendingDosesChange}
        />
      )}
    </>
  );
}

function ShiftMedDueCheckSlot(props: {
  organizationId: string;
  clientId: string;
  clientName: string;
  clockInIso: string;
  emarHref: string;
  onResolvedChange: (resolved: boolean) => void;
  onPendingDosesChange: (pending: PendingMedDose[]) => void;
}) {
  // The captured end must reset only when the active shift changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const windowEnd = useMemo(() => new Date().toISOString(), [props.clockInIso]);
  return (
    <ShiftMedDueCheck
      organizationId={props.organizationId}
      clientId={props.clientId}
      clientName={props.clientName}
      windowStart={props.clockInIso}
      windowEnd={windowEnd}
      emarHref={props.emarHref}
      onResolvedChange={props.onResolvedChange}
      onPendingDosesChange={props.onPendingDosesChange}
    />
  );
}
