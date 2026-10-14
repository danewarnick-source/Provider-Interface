// Review what Nectar read from a 1056, the same way as a PCSP review: every
// value shows the page it came from (hover for the exact words), anything
// can be fixed, and nothing is saved until Confirm. Codes the agency isn't
// approved for, unreal dates and part units block Confirm.

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { review1056Problems, type Review1056 } from "@/lib/clients/auth-1056";
import type { Read1056Result } from "@/lib/clients/budget-parse.functions";
import { PcspReviewChecks } from "../plans/pcsp-review-checks";
import { Fill1056Lines } from "./fill-1056-lines";

export type Review1056Edit = (change: (draft: Review1056) => void) => void;

export function Fill1056Review({
  read,
  review,
  onChange,
  saving,
  onConfirm,
  onClose,
}: {
  read: Read1056Result;
  review: Review1056;
  onChange: (next: Review1056) => void;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const edit: Review1056Edit = (change) => {
    const draft = structuredClone(review);
    change(draft);
    onChange(draft);
  };
  const problems = review1056Problems(review, read.agencyCodes);
  const hint = (s: { page: number | null; quote: string } | null | undefined) =>
    s?.quote ? (
      <span className="ml-1 text-[10px] text-muted-foreground" title={s.quote}>
        p.{s.page ?? "?"}
      </span>
    ) : null;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !saving) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
        data-testid="fill-1056-review"
      >
        <DialogHeader>
          <DialogTitle>Review the 1056</DialogTitle>
          <DialogDescription>
            {read.fileName} · Nectar read this form and quoted the page for every value. Check each
            line, fix anything that's wrong, then confirm. Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        <section className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="r1056-number" className="text-xs">
              1056 number{hint(read.read.authorizationNumber)}
            </Label>
            <Input
              id="r1056-number"
              className="h-8"
              value={review.authorizationNumber}
              maxLength={40}
              onChange={(e) =>
                edit((d) => {
                  d.authorizationNumber = e.target.value;
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r1056-approved" className="text-xs">
              Approved{hint(read.read.approvedOn)}
            </Label>
            <Input
              id="r1056-approved"
              type="date"
              className="h-8"
              value={review.approvedOn ?? ""}
              onChange={(e) =>
                edit((d) => {
                  d.approvedOn = e.target.value || null;
                })
              }
            />
          </div>
        </section>

        <PcspReviewChecks
          issues={read.checks.map((message) => ({ level: "warn" as const, message }))}
        />
        {read.agencyCodes.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Your agency's approved codes aren't set up, so codes weren't checked against them.
          </p>
        )}
        <Fill1056Lines review={review} edit={edit} hint={hint} />

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-destructive">{problems[0] ?? ""}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={saving || problems.length > 0}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Save authorizations from the 1056
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
