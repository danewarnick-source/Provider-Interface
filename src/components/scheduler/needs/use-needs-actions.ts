// What the Needs you buttons do (B5). Each calls one server function, then
// refreshes Needs you and the board; errors show their one line. A server
// answer that needs a reason ("Add a reason to go ahead: …", from the rule
// engine on a swap) or an action that takes one (Didn't happen, Ask for more
// detail) opens the reason dialog and runs again with what was typed.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastRuleWarnings } from "@/components/scheduler/shared/rule-warnings";
import { acknowledgeCallout, askPunchFix, sendCardReminder } from "@/lib/scheduler/needs.functions";
import { decideClaim } from "@/lib/scheduler/open-shifts.functions";
import { reviewPunchFix } from "@/lib/scheduler/punch-review.functions";
import { approveSwap, decideTimeOff, denySwap } from "@/lib/scheduler/requests.functions";
import { cancelShift } from "@/lib/scheduler/scheduler.functions";
import { startEscalation, stopEscalation } from "@/lib/scheduler/escalation.functions";

const NEED_REASON = "Add a reason to go ahead:";

export type ReasonAsk = {
  title: string;
  body: string;
  action: string;
  run: (reason: string) => Promise<boolean>;
};

const errText = (e: unknown) => (e instanceof Error ? e.message : "That didn't save. Try again.");

export function useNeedsActions(orgId: string) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<ReasonAsk | null>(null);
  const fns = {
    ack: useServerFn(acknowledgeCallout),
    askPunch: useServerFn(askPunchFix),
    remind: useServerFn(sendCardReminder),
    cancel: useServerFn(cancelShift),
    claim: useServerFn(decideClaim),
    swapOk: useServerFn(approveSwap),
    swapNo: useServerFn(denySwap),
    timeOff: useServerFn(decideTimeOff),
    punch: useServerFn(reviewPunchFix),
    escalate: useServerFn(startEscalation),
    stopEscalation: useServerFn(stopEscalation),
  };
  const org = orgId;

  /** Runs one action for a row; `done` turns the result into the toast. */
  async function run<T>(key: string, op: () => Promise<T>, done: (r: T) => string) {
    setBusy(key);
    try {
      const r = await op();
      toast.success(done(r));
      toastRuleWarnings(r as { warnings?: string[] });
      void qc.invalidateQueries({ queryKey: ["needs-you"] });
      void qc.invalidateQueries({ queryKey: ["scheduler-board"] });
      void qc.invalidateQueries({ queryKey: ["records-needs-review"] });
      return true;
    } catch (e) {
      toast.error(errText(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    ask,
    closeAsk: () => setAsk(null),
    done: (key: string, calloutId: string) =>
      run(
        key,
        () => fns.ack({ data: { organization_id: org, callout_id: calloutId } }),
        () => "Call-out marked done",
      ),
    askPunch: (key: string, shiftId: string, who: string) =>
      run(
        key,
        () => fns.askPunch({ data: { organization_id: org, shift_id: shiftId } }),
        () => `Asked ${who} to fix their punch`,
      ),
    remind: (key: string, staffId: string, card: string) =>
      run(
        key,
        () => fns.remind({ data: { organization_id: org, staff_id: staffId, card } }),
        () => "Reminder sent",
      ),
    claim: (key: string, shiftId: string, approve: boolean) =>
      run(
        key,
        () => fns.claim({ data: { shiftId, approve } }),
        () => (approve ? "Claim approved" : "Claim not approved"),
      ),
    swapNo: (key: string, id: string) =>
      run(
        key,
        () => fns.swapNo({ data: { organization_id: org, request_id: id } }),
        () => "Swap not approved",
      ),
    timeOff: (key: string, id: string, approve: boolean) =>
      run(
        key,
        () => fns.timeOff({ data: { organization_id: org, request_id: id, approve } }),
        (r) =>
          !approve
            ? "Time off not approved"
            : r.shifts
              ? `Time off approved · ${r.shifts} shift${r.shifts > 1 ? "s" : ""} need${r.shifts > 1 ? "" : "s"} someone else`
              : "Time off approved",
      ),
    escalate: (key: string, shiftId: string) =>
      run(
        key,
        () => fns.escalate({ data: { organization_id: org, shift_id: shiftId } }),
        (r) => r.message || "Escalation started",
      ),
    stopEscalation: (key: string, shiftId: string) =>
      run(
        key,
        () => fns.stopEscalation({ data: { organization_id: org, shift_id: shiftId } }),
        () => "Escalation stopped",
      ),
    approveFix: (key: string, id: string) =>
      run(
        key,
        () => fns.punch({ data: { organization_id: org, timesheet_id: id, approve: true } }),
        () => "Correction approved. The corrected times bill.",
      ),

    swapOk(key: string, id: string) {
      const go = (reason: string | null) =>
        fns.swapOk({ data: { organization_id: org, request_id: id, override_reason: reason } });
      setBusy(key);
      return go(null)
        .then((r) => {
          toastRuleWarnings(r);
          toast.success("Swap approved");
          void qc.invalidateQueries({ queryKey: ["needs-you"] });
          void qc.invalidateQueries({ queryKey: ["scheduler-board"] });
        })
        .catch((e) => {
          const msg = errText(e);
          if (!msg.startsWith(NEED_REASON)) return void toast.error(msg);
          setAsk({
            title: "Add a reason to go ahead",
            body: msg.slice(NEED_REASON.length).trim(),
            action: "Approve with this reason",
            run: (reason) =>
              run(
                key,
                () => go(reason),
                () => "Swap approved",
              ),
          });
        })
        .finally(() => setBusy(null));
    },
    didntHappen(key: string, shiftId: string) {
      setAsk({
        title: "Didn't happen",
        body: "The shift is cancelled and stays on record with your reason. Nothing is deleted.",
        action: "Cancel the shift",
        run: (reason) =>
          run(
            key,
            () =>
              fns.cancel({ data: { id: shiftId, organization_id: org, cancel_reason: reason } }),
            () => "Shift cancelled. It stays on record.",
          ),
      });
    },
    moreDetail(key: string, id: string) {
      setAsk({
        title: "Ask for more detail",
        body: "They'll see your note on their correction and can send it again.",
        action: "Send it back",
        run: (note) =>
          run(
            key,
            () =>
              fns.punch({ data: { organization_id: org, timesheet_id: id, approve: false, note } }),
            () => "Sent back with your note",
          ),
      });
    },
  };
}

export type NeedsActions = ReturnType<typeof useNeedsActions>;
