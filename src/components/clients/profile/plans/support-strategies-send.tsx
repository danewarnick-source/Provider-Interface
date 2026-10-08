// "Mark as sent to support coordinator" on the Support strategies card: once
// the strategies are approved (or an uploaded document is on file) and not
// yet sent for the current plan year, a small dialog records the date sent
// (today by default, can be earlier) to the client's support coordinator.
// Once sent: "Sent to Angela Duty · Oct 8, 2026 · Dane Warnick" with Undo.
// The rule is strategy-sends.ts; the record is strategy-sends.functions.ts.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { denverYmd } from "@/lib/denver-date";
import { sentLine } from "@/lib/clients/strategy-sends";
import {
  getStrategySendStatus,
  markStrategiesSent,
  voidStrategiesSent,
} from "@/lib/clients/strategy-sends.functions";
import { clientFileKey } from "@/components/clients/profile/file/use-client-file";

export const strategySendKey = (clientId: string) => ["strategy-send", clientId] as const;

export function StrategiesSendRow({
  clientId,
  fromUpload,
}: {
  clientId: string;
  /** An uploaded strategies document: it can be sent without approving copied strategies. */
  fromUpload: boolean;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getStrategySendStatus);
  const markFn = useServerFn(markStrategiesSent);
  const voidFn = useServerFn(voidStrategiesSent);
  const [open, setOpen] = useState(false);
  const [sentOn, setSentOn] = useState(denverYmd());
  const { data } = useQuery({
    queryKey: strategySendKey(clientId),
    queryFn: () => getFn({ data: { clientId } }),
  });
  const refresh = () => {
    for (const key of [
      strategySendKey(clientId),
      ["client-overview"],
      clientFileKey(clientId),
      ["evidence-board"],
    ]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
  const mark = useMutation({
    mutationFn: () => markFn({ data: { clientId, planId: data!.planId!, sentOn } }),
    onSuccess: () => {
      setOpen(false);
      refresh();
      toast.success("Marked as sent. A copy is filed in the Client file.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const undo = useMutation({
    mutationFn: (sendId: string) => voidFn({ data: { sendId } }),
    onSuccess: () => {
      refresh();
      toast.success("Send undone.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data?.state) return null;
  const { state, planId, coordinator } = data;
  if (state.kind === "sent") {
    return (
      <div
        className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
        data-testid="strategies-sent"
      >
        <span>
          {sentLine(state)}
          {state.late ? " · late" : ""}
        </span>
        {state.sendId ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={undo.isPending}
            onClick={() => {
              if (window.confirm("Undo this send? The filed copy stays on record.")) {
                undo.mutate(state.sendId!);
              }
            }}
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
        ) : null}
      </div>
    );
  }
  const canMark =
    !!planId && (state.kind === "not_sent" || (fromUpload && state.kind === "not_approved"));
  if (!canMark) return null;
  const today = denverYmd();
  return (
    <>
      <Button
        variant="outline"
        className="max-md:min-h-11"
        onClick={() => {
          setSentOn(today);
          setOpen(true);
        }}
      >
        <Send className="h-4 w-4" />
        Mark as sent to support coordinator
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as sent</DialogTitle>
            <DialogDescription>
              Sent to {coordinator ?? "the support coordinator"}
              {coordinator ? " (support coordinator)" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="strategies-sent-on">Date sent</Label>
            <Input
              id="strategies-sent-on"
              type="date"
              value={sentOn}
              max={today}
              onChange={(e) => setSentOn(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!sentOn || sentOn > today || mark.isPending}
              onClick={() => mark.mutate()}
            >
              {mark.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
