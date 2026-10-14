// Monthly sign-off for the MAR tab: the review status, "Sign off this
// month" (medical edit rights, after the month's last day), the signed PDF,
// and reopening a signed month with a reason (logged).

import { useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RecordDialog } from "@/components/clients/profile/health/record-dialog";
import { longDateTime } from "@/lib/medications/mar-month";
import { useMedicationFiles } from "./use-medications";
import { useReopenMar, useSignOffMar, type MarMonth } from "./use-mar";

export function MarSignOff({
  clientId,
  data,
  canEdit,
}: {
  clientId: string;
  data: MarMonth;
  canEdit: boolean;
}) {
  const [dialog, setDialog] = useState<"sign" | "reopen" | null>(null);
  const [text, setText] = useState("");
  const sign = useSignOffMar(clientId, data.month);
  const reopen = useReopenMar(clientId, data.month);
  const files = useMedicationFiles(clientId);
  const review = data.review;
  const signed = review?.status === "signed";
  const close = () => {
    setDialog(null);
    setText("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="mar-signoff">
      {signed ? (
        <>
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Signed off by {review.reviewed_by_name || "a team member"},{" "}
            {longDateTime(review.reviewed_at)}
          </span>
          {review.pdf_path ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => files.open(review.pdf_path as string)}
            >
              <FileText className="mr-1 h-4 w-4" /> Signed PDF
            </Button>
          ) : null}
          {canEdit ? (
            <Button size="sm" variant="ghost" onClick={() => setDialog("reopen")}>
              Reopen
            </Button>
          ) : null}
        </>
      ) : (
        <>
          {review?.status === "reopened" ? (
            <span className="text-amber-700 dark:text-amber-300">
              Reopened {longDateTime(review.reopened_at)}: {review.reopen_reason}
            </span>
          ) : (
            <span className="text-muted-foreground">Not signed off yet.</span>
          )}
          {canEdit && data.canSignOff ? (
            <Button size="sm" onClick={() => setDialog("sign")} data-testid="mar-signoff-open">
              Sign off this month
            </Button>
          ) : null}
          {canEdit && !data.canSignOff ? (
            <span className="text-xs text-muted-foreground">
              You can sign off after the month's last day.
            </span>
          ) : null}
        </>
      )}
      <RecordDialog
        title="Sign off this month"
        saveLabel="Sign off"
        open={dialog === "sign"}
        saving={sign.isPending}
        problem={null}
        onClose={close}
        onSave={() => sign.mutate(text.trim() || null, { onSuccess: close })}
      >
        <p className="text-sm text-muted-foreground">
          This saves the month's MAR as a PDF in the client's documents with your name and the date.
          A signed month can't be changed unless it's reopened.
        </p>
        <div className="space-y-1">
          <Label>Review notes (optional)</Label>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </RecordDialog>
      <RecordDialog
        title="Reopen this month"
        saveLabel="Reopen"
        open={dialog === "reopen"}
        saving={reopen.isPending}
        problem={text.trim().length < 3 ? "Add a reason." : null}
        onClose={close}
        onSave={() => reopen.mutate(text.trim(), { onSuccess: close })}
      >
        <p className="text-sm text-muted-foreground">
          Reopening is recorded. The signed PDF stays in the client's documents.
        </p>
        <div className="space-y-1">
          <Label>Reason</Label>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </RecordDialog>
    </div>
  );
}
