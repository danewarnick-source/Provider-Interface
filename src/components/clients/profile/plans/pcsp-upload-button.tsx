// Upload a PCSP → review → confirm. The one way a PCSP comes in: the profile
// header and the Plan years card ("Upload PCSP", or "Upload new PCSP" once
// the client has a plan) and File → Documents with type PCSP. With a plan on
// file, a confirm explains what a new plan year changes before the file
// picker opens. Nothing about the plan is written until the review's
// Confirm. A failed read or the saved result stays on screen in
// PcspOutcomeDialog.

import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClientPlans } from "@/components/clients/shared/hooks/use-plan-goals";
import { usePcspImport } from "./use-pcsp-import";
import { PcspReview } from "./pcsp-review";
import { PcspOutcomeDialog } from "./pcsp-outcome-dialog";

/**
 * The PCSP upload flow without its button: `start()` (from a click) asks
 * first when a plan exists, then opens the file picker; `element` holds the
 * hidden input and the dialogs and must stay mounted.
 */
export function usePcspUploadFlow(
  clientId: string,
  orgId: string | undefined,
  inputTestId: string,
) {
  const pcsp = usePcspImport(clientId, orgId);
  const hasPlan = (useClientPlans(clientId).data?.plans.length ?? 0) > 0;
  const fileRef = useRef<HTMLInputElement>(null);
  const [warn, setWarn] = useState(false);
  const pick = () => fileRef.current?.click();
  const start = () => (hasPlan ? setWarn(true) : pick());
  const element = (
    <>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,application/pdf"
        data-testid={inputTestId}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pcsp.upload(f);
          e.target.value = "";
        }}
      />
      <Dialog open={warn} onOpenChange={setWarn}>
        <DialogContent className="max-w-md" data-testid="new-pcsp-confirm">
          <DialogHeader>
            <DialogTitle>Upload a new PCSP?</DialogTitle>
            <DialogDescription>
              This starts a new plan year. The current plan moves to past. Plan dates, goals and
              codes come from the new PCSP. Support strategies must be reviewed, approved and sent
              to the support coordinator again within 30 days of the new PCSP's activation date.
              Reminders and summaries follow the new dates.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarn(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setWarn(false);
                pick();
              }}
            >
              Choose PCSP file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {pcsp.read && pcsp.review ? (
        <PcspReview
          read={pcsp.read}
          review={pcsp.review}
          onChange={pcsp.setReview}
          saving={pcsp.saving}
          error={pcsp.saveError}
          onConfirm={() => void pcsp.confirm()}
          onClose={pcsp.close}
        />
      ) : null}
      {pcsp.outcome ? (
        <PcspOutcomeDialog
          clientId={clientId}
          outcome={pcsp.outcome}
          retrying={pcsp.reading}
          onRetry={pcsp.retry}
          onClose={pcsp.dismiss}
        />
      ) : null}
    </>
  );
  return {
    start,
    element,
    reading: pcsp.reading,
    label: hasPlan ? "Upload new PCSP" : "Upload PCSP",
  };
}

export function PcspUploadButton({
  clientId,
  orgId,
  variant = "default",
  inputTestId,
}: {
  clientId: string;
  orgId: string | undefined;
  variant?: "default" | "outline";
  inputTestId: string;
}) {
  const flow = usePcspUploadFlow(clientId, orgId, inputTestId);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={flow.reading || !orgId}
        onClick={flow.start}
      >
        {flow.reading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        {flow.reading ? "Reading the PCSP…" : flow.label}
      </Button>
      {flow.element}
    </>
  );
}
