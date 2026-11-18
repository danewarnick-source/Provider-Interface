// Publish / Send changes (B4, the demo's dlgPublish), opened from the board
// header. Loads the week's checklist (previewPublish) and shows it
// (publish-checklist.tsx). Send (sendChanges) publishes the drafts with their
// reasons, marks the changes sent, notifies only the people affected and
// offers the open shifts; it stays disabled while a block or an empty
// required reason remains, and says which. Not yet closes; typed reasons are
// kept until Send.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { previewPublish, sendChanges } from "@/lib/scheduler/publish.functions";
import { sendBlocker } from "@/lib/scheduler/publish-plan";
import { useBoard } from "./board-context";
import { PublishChecklist, type Reasons } from "./publish-checklist";

export function PublishDialog({
  reasons,
  setReasons,
}: {
  reasons: Reasons;
  setReasons: (r: Reasons) => void;
}) {
  const b = useBoard();
  const qc = useQueryClient();
  const preview = useServerFn(previewPublish);
  const send = useServerFn(sendChanges);
  const week = b.days[0]!;
  const q = useQuery({
    queryKey: ["scheduler-board", "publish", b.orgId, week],
    queryFn: () => preview({ data: { organization_id: b.orgId, week_start: week } }),
    staleTime: 0,
  });
  const plan = q.data;
  const go = useMutation({
    mutationFn: () => send({ data: { organization_id: b.orgId, week_start: week, reasons } }),
    onSuccess: (r) => {
      toast.success(`Sent · ${r.people} ${r.people === 1 ? "person" : "people"} notified`, {
        description: r.offered.shifts
          ? `${r.offered.shifts} open shift${r.offered.shifts === 1 ? "" : "s"} offered to ${r.offered.people} qualified.`
          : undefined,
      });
      setReasons({});
      void qc.invalidateQueries({ queryKey: ["scheduler-board"] });
      void qc.invalidateQueries({ queryKey: ["open-shifts"] });
      b.close();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const blocker = q.error
    ? "The checks didn't load."
    : plan
      ? sendBlocker(plan, reasons)
      : "Checking the week…";
  const title = plan?.count
    ? `Send ${plan.count} change${plan.count === 1 ? "" : "s"}`
    : plan
      ? "Nothing new to send"
      : "Publish";

  return (
    <Dialog open onOpenChange={(o) => !o && !go.isPending && b.close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Every draft and changed shift this week, checked against the SOW and your agency's
            rules.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading && <p className="text-sm text-[var(--hive-text-muted)]">Checking the week…</p>}
        {q.error && (
          <div className="space-y-2 text-sm text-[var(--hive-danger)]">
            <p>The checks didn't load: {q.error.message}</p>
            <Button variant="outline" className="min-h-11" onClick={() => void q.refetch()}>
              Check again
            </Button>
          </div>
        )}
        {plan && <PublishChecklist plan={plan} reasons={reasons} setReasons={setReasons} />}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
          {blocker && (
            <span id="send-blocker" className="text-xs text-[var(--hive-text-muted)] sm:mr-auto">
              {blocker}
            </span>
          )}
          <Button variant="outline" className="min-h-11" onClick={b.close}>
            Not yet
          </Button>
          <Button
            className="min-h-11"
            disabled={!!blocker || go.isPending}
            title={blocker ?? undefined}
            aria-describedby={blocker ? "send-blocker" : undefined}
            onClick={() => go.mutate()}
          >
            {go.isPending ? "Sending…" : "Send changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
