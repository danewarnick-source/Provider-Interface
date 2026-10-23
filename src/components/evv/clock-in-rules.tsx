// The scheduler rules at clock-in (B1), for the punch pad. check() asks the
// server (checkClockIn) before the punch is written:
//   refused        → a toast with the one-line reason; nothing is written.
//   needs a reason → a dialog where the team member types it (Decision 4);
//                    the reason is saved on the punch.
//   go ahead       → resolves with the scheduled shift to link the punch to.
// Warnings show as a toast and never stop the clock-in.
import { useCallback, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { checkClockIn } from "@/lib/scheduler/clock-in.functions";

export type ClockInRulesResult = { scheduledShiftId: string | null; reason: string | null };

type Ask = { lines: string[]; resolve: (reason: string | null) => void };

const MIN_REASON = 10;

export function useClockInRules() {
  const check = useServerFn(checkClockIn);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [reason, setReason] = useState("");
  const askRef = useRef<Ask | null>(null);

  const askForReason = (lines: string[]) =>
    new Promise<string | null>((resolve) => {
      const next = { lines, resolve };
      askRef.current = next;
      setReason("");
      setAsk(next);
    });

  const finish = (value: string | null) => {
    askRef.current?.resolve(value);
    askRef.current = null;
    setAsk(null);
  };

  const run = useCallback(
    async (args: {
      organizationId: string;
      clientId: string;
      serviceCode: string;
    }): Promise<ClockInRulesResult | null> => {
      let r = await check({ data: args });
      let typed: string | null = null;
      if (r.refusal && r.reasonLines.length) {
        typed = await askForReason(r.reasonLines);
        if (!typed) return null;
        r = await check({ data: { ...args, reason: typed } });
      }
      if (r.refusal) {
        toast.error(r.refusal);
        return null;
      }
      if (r.warnings.length) toast.warning(r.warnings.join(" · "));
      return { scheduledShiftId: r.scheduledShiftId, reason: typed };
    },
    [check],
  );

  const short = reason.trim().length < MIN_REASON;
  const dialogElement = (
    <Dialog
      open={!!ask}
      onOpenChange={(open) => {
        // Never drop a typed reason on click-out or Escape; Cancel discards it.
        if (!open && !reason.trim()) finish(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a reason to clock in</DialogTitle>
          <DialogDescription>
            Your agency asks for a reason before this clock-in. Your lead sees it.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {ask?.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <Textarea
          autoFocus
          aria-label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why you're clocking in anyway"
          maxLength={1000}
        />
        {short && (
          <p className="text-xs text-muted-foreground">Type at least {MIN_REASON} characters.</p>
        )}
        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={() => finish(null)}>
            Cancel
          </Button>
          <Button className="min-h-11" disabled={short} onClick={() => finish(reason.trim())}>
            Clock in with this reason
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { check: run, dialogElement };
}
