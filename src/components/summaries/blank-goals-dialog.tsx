// Soft confirm on Finalize when a goal has no progress text. It only asks;
// "Finalize anyway" always goes on.

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function BlankGoalsDialog({
  goals,
  onBack,
  onContinue,
}: {
  goals: string[];
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onBack()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalize anyway?</DialogTitle>
        </DialogHeader>
        <ul className="space-y-1 text-sm" data-testid="summary-blank-goals">
          {goals.map((g) => (
            <li key={g}>{g} has no progress written.</li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onBack}>
            Go back
          </Button>
          <Button onClick={onContinue} data-testid="summary-finalize-anyway">
            Finalize anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
