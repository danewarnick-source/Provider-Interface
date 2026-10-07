// Review a PCSP that was just read: issues first ("Fix before confirming",
// "Check these", with page numbers), then the plan year, counts, our budget,
// goals (carried over or new) and other needs. Every field can be fixed
// here. Nothing is saved until "Confirm PCSP".
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PcspRead } from "@/lib/clients/pcsp/import.functions";
import { confirmProblems } from "@/lib/clients/pcsp/confirm-plan";
import { reviewSummary, type ReviewedPcsp } from "@/lib/clients/pcsp/review";
import { formatDate } from "@/lib/clients/dates";
import { PcspReviewChecks } from "./pcsp-review-checks";
import { PcspReviewBudget } from "./pcsp-review-budget";
import { PcspReviewGoals } from "./pcsp-review-goals";
import { PcspReviewExtras } from "./pcsp-review-extras";

export type ReviewEdit = (change: (draft: ReviewedPcsp) => void) => void;

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function PcspReview({
  read, review, onChange, saving, onConfirm, onClose,
}: {
  read: PcspRead;
  review: ReviewedPcsp;
  onChange: (next: ReviewedPcsp) => void;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const edit: ReviewEdit = (change) => {
    const draft = structuredClone(review);
    change(draft);
    onChange(draft);
  };
  const sum = reviewSummary(read.parse, review);
  const problems = confirmProblems(review);
  const plan = review.plan;
  const date = (key: keyof ReviewedPcsp["plan"], label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`pcsp-${key}`} className="text-xs">{label}</Label>
      <Input
        id={`pcsp-${key}`} type="date" className="h-9" value={plan[key] ?? ""}
        onChange={(e) => edit((d) => { d.plan[key] = e.target.value || null; })}
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" data-testid="pcsp-review">
        <DialogHeader>
          <DialogTitle>Review the new PCSP</DialogTitle>
          <DialogDescription>
            {read.fileName} · Check what was read, fix anything that's wrong, then confirm. Nothing is saved to the plan until you confirm.
          </DialogDescription>
        </DialogHeader>

        <PcspReviewChecks issues={read.parse.issues} />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            Plan year {plan.start && plan.end ? `${formatDate(plan.start)} – ${formatDate(plan.end)}` : "(dates not found)"}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {date("start", "Starts")}
            {date("end", "Ends")}
            {date("activatedOn", "Activated")}
            {date("meetingDate", "Meeting")}
          </div>
          {read.currentPlan && (
            <p className="text-xs text-muted-foreground">
              Replaces the current plan year{read.currentPlan.start_date ? ` ${formatDate(read.currentPlan.start_date)} – ${formatDate(read.currentPlan.end_date)}` : ""} once this one starts.
            </p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" aria-label="Counts">
          <Stat label="Goals" value={String(sum.goals)} />
          <Stat label="Supports" value={`${sum.supports} (${sum.supportsForUs} for us)`} />
          <Stat label="Compared with last year" value={`${sum.carried} carried over · ${sum.newGoals} new`} />
          <Stat label="Budget for us" value={money(sum.budgetTotalForUs)} />
        </section>

        {read.nectarSections.length > 0 && (
          <p className="rounded-xl border border-hive-gold/50 bg-hive-gold-soft p-2 text-xs text-hive-ink">
            Nectar read {read.nectarSections.join(", ")} because the layout was unusual. Every value it read quotes the PDF — check them.
          </p>
        )}

        <PcspReviewBudget review={review} edit={edit} />
        <PcspReviewGoals read={read} review={review} edit={edit} />
        <PcspReviewExtras review={review} edit={edit} />

        <DialogFooter className="flex-col items-stretch gap-2 border-t border-hive-border pt-4 sm:flex-row sm:items-center sm:justify-between max-md:[&_button]:min-h-11">
          <p className="text-xs text-destructive">{problems[0] ?? ""}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={onConfirm} disabled={saving || problems.length > 0}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Confirm PCSP
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
