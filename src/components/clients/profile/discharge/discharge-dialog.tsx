// Guided discharge: details → summary → review. Saving ends the client's
// active authorizations, takes the team off, cancels future shifts and moves
// the client to Discharged (discharge.functions.ts → dischargeClient).

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { todayYmd } from "@/lib/clients/dates";
import { dischargeProblems, type InitiatedBy } from "@/lib/clients/discharge";
import { DetailsStep, type DischargeDetails } from "./details-step";
import { ReviewStep } from "./review-step";
import { SummaryFields, type SummaryDraftState } from "./summary-fields";
import { useDischargePreview, useDischargeWrites, useDraftSummary } from "./use-discharge";

const STEPS = ["Details", "Summary", "Review"] as const;
const EMPTY_SUMMARY: SummaryDraftState = { text: "", draftedByNectar: false, confirmed: false };

export function DischargeDialog({
  open,
  onOpenChange,
  orgId,
  clientId,
  name,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  clientId: string;
  name: string;
  onChanged: () => void;
}) {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<DischargeDetails>(() => ({
    dischargeDate: todayYmd(),
    reason: "",
    initiatedBy: "",
    noticeDate: "",
  }));
  const [summary, setSummary] = useState<SummaryDraftState>(EMPTY_SUMMARY);
  const preview = useDischargePreview(orgId, clientId, details.dischargeDate, open && step === 2);
  const draft = useDraftSummary(orgId, clientId);
  const { discharge } = useDischargeWrites(orgId, clientId, onChanged);

  const input = {
    ...details,
    summaryText: summary.text,
    summaryConfirmed: summary.confirmed,
  };
  const detailProblems = dischargeProblems({ ...input, summaryText: "", summaryConfirmed: false });
  const problems = dischargeProblems(input);

  const close = (next: boolean) => {
    if (!next) {
      setStep(0);
      setSummary(EMPTY_SUMMARY);
    }
    onOpenChange(next);
  };

  const askNectar = () =>
    draft.mutate(
      {
        dischargeDate: details.dischargeDate,
        reason: details.reason,
        initiatedBy: details.initiatedBy as InitiatedBy,
      },
      {
        onSuccess: (r) => setSummary({ text: r.text, draftedByNectar: true, confirmed: false }),
        onError: (e: Error) => toast.error(e.message),
      },
    );

  const save = () =>
    discharge.mutate(
      { ...input, summaryDraftedByNectar: summary.draftedByNectar },
      {
        onSuccess: () => {
          toast.success(`${name} is discharged. The record is kept.`);
          close(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );

  const canNext = step === 0 ? detailProblems.length === 0 : problems.length === 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg" data-testid="discharge-dialog">
        <DialogHeader>
          <DialogTitle>Discharge {name}</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>
        {step === 0 ? <DetailsStep value={details} onChange={setDetails} /> : null}
        {step === 1 ? (
          <SummaryFields
            value={summary}
            onChange={setSummary}
            onDraft={askNectar}
            drafting={draft.isPending}
          />
        ) : null}
        {step === 2 ? (
          <ReviewStep
            preview={preview.data}
            loading={preview.isLoading}
            error={preview.error as Error | null}
            dischargeDate={details.dischargeDate}
            summaryConfirmed={summary.confirmed}
          />
        ) : null}
        {step === 0 && details.reason && detailProblems.length ? (
          <p className="text-xs text-destructive">{detailProblems.join(" ")}</p>
        ) : null}
        <DialogFooter>
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              disabled={!canNext}
              onClick={() => setStep(step + 1)}
              data-testid="discharge-next"
            >
              Next
            </Button>
          ) : (
            <Button
              variant="destructive"
              disabled={!canNext || discharge.isPending || preview.isLoading}
              onClick={save}
              data-testid="discharge-save"
            >
              {discharge.isPending ? "Discharging…" : "Discharge client"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
