// The escalation part of a Needs you row (call-out, open shift, 1:1 not
// covered): the ladder's line ("Asked Maria (lead) 2:41 PM · on-call next at
// 2:56 PM", "No one available · escalation finished") and Start escalation /
// Stop escalation (escalation.functions.ts through useNeedsActions). Start is
// hidden while it runs or once the shift has a person; Stop shows only while
// it runs. Without Scheduling edit the button is disabled and says why.
import { Button } from "@/components/ui/button";
import type { NeedItem } from "@/lib/scheduler/needs-items";
import type { NeedsActions } from "./use-needs-actions";

const LINE_CLASS = {
  running: "text-[var(--hive-text)]",
  stopped: "text-[var(--hive-text-muted)]",
  finished: "font-semibold text-[var(--hive-danger)]",
  none: "",
} as const;

export function EscalationControls({
  item: i,
  act,
  canEdit,
}: {
  item: NeedItem;
  act: NeedsActions;
  canEdit: boolean;
}) {
  const e = i.escalation;
  if (!e || !i.shiftId) return null;
  const running = e.state === "running";
  if (!running && !e.canStart && !e.line) return null;
  const off = canEdit ? undefined : "Needs Scheduling edit access.";
  return (
    <div className="space-y-1">
      {e.line && <p className={`text-xs ${LINE_CLASS[e.state]}`}>{e.line}</p>}
      {(running || e.canStart) && (
        <Button
          variant="outline"
          className="min-h-11"
          disabled={act.busy === i.key || !!off}
          title={off}
          onClick={(ev) => {
            ev.stopPropagation();
            void (running
              ? act.stopEscalation(i.key, i.shiftId!)
              : act.escalate(i.key, i.shiftId!));
          }}
        >
          {running ? "Stop escalation" : "Start escalation"}
        </Button>
      )}
      {off && (running || e.canStart) && (
        <p className="text-xs text-[var(--hive-text-muted)]">{off}</p>
      )}
    </div>
  );
}
