// After Upload PCSP: why the read failed (with "Try again"), or what was
// saved and filed, with the next step: Nectar's About draft to approve.
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PcspReadFailed } from "@/components/clients/shared/pcsp-read-notes";
import type { PcspOutcome } from "./use-pcsp-import";

export function PcspOutcomeDialog({
  clientId,
  outcome,
  retrying,
  onRetry,
  onClose,
}: {
  clientId: string;
  outcome: PcspOutcome;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const saved = outcome.kind === "saved";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="pcsp-outcome">
        <DialogHeader>
          <DialogTitle>{saved ? "PCSP saved" : "Couldn't read the PCSP"}</DialogTitle>
          <DialogDescription>
            {saved ? "Here's what the PCSP filled in." : "Nothing was saved to the plan."}
          </DialogDescription>
        </DialogHeader>
        {saved ? (
          <ul className="space-y-2 text-sm">
            {outcome.lines.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--hive-ok)]" />
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <PcspReadFailed message={outcome.message} retrying={retrying} onRetry={onRetry} />
        )}
        <DialogFooter className="gap-2 max-md:[&_a]:min-h-11 max-md:[&_button]:min-h-11">
          {saved && (
            <Button asChild variant="outline">
              <Link
                to="/dashboard/clients/$clientId"
                params={{ clientId }}
                search={{ section: "profile", about: "draft" }}
                onClick={onClose}
              >
                <Sparkles className="h-4 w-4" /> Draft the About summary with Nectar
              </Link>
            </Button>
          )}
          <Button onClick={onClose}>{saved ? "Done" : "Close"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
