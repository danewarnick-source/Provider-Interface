// The Publish dialog's checklist (B4, the demo's dlgPublish), in order:
// blocks (each with Open shift, which opens the shift's drawer and comes back
// here on close), shifts needing a reason (one box each, plus "Use this reason
// for all N like it"), reminders, over the overtime threshold, exactly who
// gets a notice, and the open shifts offered at Send. Reads a PublishPlan
// (publish-plan.ts); typed reasons live in BoardDrawers so they survive a trip
// to a shift's drawer.
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sameRuleShifts, type PlanLine, type PublishPlan } from "@/lib/scheduler/publish-plan";
import { staffName, useBoard } from "./board-context";
import { shiftLabel } from "./shift-label";

export type Reasons = Record<string, string>;

const TONE = {
  ok: { mark: "✓", cls: "text-[var(--hive-ok)]" },
  warn: { mark: "!", cls: "text-[var(--hive-gold)]" },
  bad: { mark: "✕", cls: "text-[var(--hive-danger)]" },
};

function Item({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return (
    <li className="flex gap-2 rounded-md border border-[var(--hive-border)] p-3 text-sm">
      <span aria-hidden className={`font-bold ${TONE[tone].cls}`}>
        {TONE[tone].mark}
      </span>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </li>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function byShift(lines: readonly PlanLine[]): [string, PlanLine[]][] {
  const out = new Map<string, PlanLine[]>();
  for (const l of lines) out.set(l.shiftId, [...(out.get(l.shiftId) ?? []), l]);
  return [...out];
}

function ReasonBox({
  plan,
  id,
  lines,
  reasons,
  setReasons,
}: {
  plan: PublishPlan;
  id: string;
  lines: PlanLine[];
  reasons: Reasons;
  setReasons: (r: Reasons) => void;
}) {
  const b = useBoard();
  const label = shiftLabel(b, id);
  const text = reasons[id] ?? "";
  const alike = sameRuleShifts(plan, lines[0]!);
  return (
    <div className="space-y-1">
      <div className="font-semibold">{label}</div>
      <div className="text-[var(--hive-text-muted)]">{lines.map((l) => l.message).join(" · ")}</div>
      <Textarea
        aria-label={`Reason for ${label}`}
        placeholder="Why (saved on the shift)"
        maxLength={1000}
        rows={2}
        value={text}
        onChange={(e) => setReasons({ ...reasons, [id]: e.target.value })}
      />
      {text.trim() && alike.length > 1 && (
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() =>
            setReasons({ ...reasons, ...Object.fromEntries(alike.map((x) => [x, text])) })
          }
        >
          Use this reason for all {alike.length} like it
        </Button>
      )}
    </div>
  );
}

export function PublishChecklist({
  plan,
  reasons,
  setReasons,
}: {
  plan: PublishPlan;
  reasons: Reasons;
  setReasons: (r: Reasons) => void;
}) {
  const b = useBoard();
  const reminders = [
    ...new Set(plan.reminders.map((l) => `${shiftLabel(b, l.shiftId)}: ${l.message}`)),
  ];
  const names = plan.notify.map((id) => staffName(b, id)).sort();
  return (
    <ul className="space-y-2">
      {plan.blocks.length ? (
        <Item tone="bad">
          <div className="font-semibold">
            {plural(plan.blocks.length, "block")}. Fix before sending.
          </div>
          {plan.blocks.map((l) => (
            <div key={`${l.shiftId}${l.rule}`} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">
                <b>{shiftLabel(b, l.shiftId)}</b>: {l.message}
              </span>
              {b.shifts.some((x) => x.id === l.shiftId) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => b.open({ kind: "shift", id: l.shiftId, back: "publish" })}
                >
                  Open shift
                </Button>
              )}
            </div>
          ))}
        </Item>
      ) : (
        <Item tone="ok">Nothing blocks sending. No one is in two places.</Item>
      )}
      {plan.needReason.length > 0 && (
        <Item tone="warn">
          <div className="font-semibold">
            {plural(byShift(plan.needReason).length, "shift needs", "shifts need")} a reason
          </div>
          {byShift(plan.needReason).map(([id, lines]) => (
            <ReasonBox
              key={id}
              plan={plan}
              id={id}
              lines={lines}
              reasons={reasons}
              setReasons={setReasons}
            />
          ))}
        </Item>
      )}
      {reminders.length ? (
        <Item tone="warn">
          <div className="font-semibold">
            {plural(reminders.length, "reminder")} (you can send anyway)
          </div>
          <ul className="list-disc pl-5">
            {reminders.slice(0, 5).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {reminders.length > 5 && <div>and {reminders.length - 5} more.</div>}
        </Item>
      ) : (
        <Item tone="ok">
          Authorization, training, cards, age and do-not-schedule checks passed.
        </Item>
      )}
      {plan.overtime.length ? (
        <Item tone="warn">
          {plan.overtime.map((o) => `${staffName(b, o.staffId)} ${o.hours} h`).join(", ")} over{" "}
          {b.data.otHours} h. A reason typed above is saved on the shift and stays on the record.
        </Item>
      ) : (
        <Item tone="ok">No one over {b.data.otHours} h.</Item>
      )}
      <Item tone="ok">
        {names.length
          ? `${plural(names.length, "person gets", "people get")} a notice: ${names.join(", ")}.`
          : "No one gets a notice."}{" "}
        People whose shifts didn't change hear nothing.
      </Item>
      <Item tone="ok">
        {plan.openToOffer.length
          ? `${plural(plan.openToOffer.length, "open shift")} offered to everyone qualified when you send.`
          : "No open shifts waiting to be offered."}
      </Item>
    </ul>
  );
}
