// The lists behind the stat tiles: scheduled hours by place, the open shifts
// (each with Find staff and Open), and the people over the overtime threshold
// with their shifts (open one to give it to someone else).
import { Button } from "@/components/ui/button";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import {
  fmtSpan,
  isCancelled,
  isOpenShift,
  shiftDay,
  shiftHours,
  staffHours,
  type BoardShift,
} from "@/lib/scheduler/board-model";
import { useBoard, type Board } from "./board-context";
import { CodeTag, DrawerShell, Pill } from "./board-ui";
import { placeLabel } from "./shift-chip";

const when = (s: BoardShift) => `${fmtDay(shiftDay(s)).replace(/, \d{4}$/, "")} · ${fmtSpan(s)}`;

function HoursByPlace({ b, week }: { b: Board; week: BoardShift[] }) {
  const places = new Map<string, BoardShift[]>();
  for (const s of week.filter((x) => !x.parent_shift_id))
    places.set(placeLabel(b, s), [...(places.get(placeLabel(b, s)) ?? []), s]);
  if (!places.size)
    return <p className="text-sm text-[var(--hive-text-muted)]">No shifts this week.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-[var(--hive-text-muted)]">
        <tr>
          <th className="py-1">Place</th>
          <th>Shifts</th>
          <th>Hours</th>
          <th>Open</th>
        </tr>
      </thead>
      <tbody>
        {[...places]
          .sort(([a], [c]) => a.localeCompare(c))
          .map(([name, list]) => {
            const staffed = list.filter((s) => s.staff_id);
            const open = list.filter(isOpenShift).length;
            return (
              <tr key={name} className="border-t border-[var(--hive-border)]">
                <td className="py-1.5 font-semibold">{name}</td>
                <td className="tabular-nums">{staffed.length}</td>
                <td className="tabular-nums">
                  {Math.round(staffed.reduce((n, s) => n + shiftHours(s), 0) * 10) / 10} h
                </td>
                <td className="tabular-nums">{open || "—"}</td>
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}

function OpenList({ b, week }: { b: Board; week: BoardShift[] }) {
  const open = week.filter(isOpenShift);
  if (!open.length)
    return <p className="text-sm text-[var(--hive-text-muted)]">No open shifts this week.</p>;
  return (
    <div className="space-y-2">
      {open.map((s) => (
        <div
          key={s.id}
          className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--hive-border)] p-2"
        >
          <CodeTag code={s.service_code} />
          <div className="min-w-0 flex-1 text-sm">
            <b>
              {placeLabel(b, s)} · {when(s)}
            </b>
            <div className="text-xs text-[var(--hive-text-muted)]">
              {!s.published
                ? "Not offered yet"
                : s.claim_requested_by
                  ? "Someone asked for it"
                  : "Offered"}
            </div>
          </div>
          {b.canEdit && (
            <Button className="min-h-11" onClick={() => b.open({ kind: "find", id: s.id })}>
              Find staff
            </Button>
          )}
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => b.open({ kind: "shift", id: s.id })}
          >
            Open
          </Button>
        </div>
      ))}
    </div>
  );
}

function OverList({ b, week }: { b: Board; week: BoardShift[] }) {
  const over = b.data.staff.filter((p) => staffHours(week, p.id) > b.data.otHours);
  if (!over.length)
    return <p className="text-sm text-[var(--hive-text-muted)]">No one over {b.data.otHours} h.</p>;
  return (
    <div className="space-y-2">
      {over.map((p) => {
        const h = staffHours(week, p.id);
        return (
          <div key={p.id} className="rounded-md border border-[var(--hive-border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <b>{p.name}</b>
              <Pill tone="warn">
                {h} h · {Math.round((h - b.data.otHours) * 10) / 10} over
              </Pill>
            </div>
            <p className="my-1 text-xs text-[var(--hive-text-muted)]">
              Open a shift to give it to someone else.
            </p>
            <div className="flex flex-wrap gap-1">
              {week
                .filter((s) => s.staff_id === p.id)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => b.open({ kind: "shift", id: s.id })}
                    className="min-h-9 rounded-full bg-[var(--hive-muted-surface)] px-2.5 text-xs font-semibold"
                  >
                    {when(s)} · {placeLabel(b, s)}
                  </button>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TITLES = {
  hours: "Scheduled hours by place",
  open: "Open shifts",
  ot: "People over the overtime threshold",
} as const;

export function WeekListDrawer({ which }: { which: keyof typeof TITLES }) {
  const b = useBoard();
  const week = b.shifts
    .filter((s) => !isCancelled(s) && b.days.includes(shiftDay(s)))
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  return (
    <DrawerShell
      open
      onClose={b.close}
      kicker="This week"
      title={TITLES[which]}
      footer={
        <Button variant="outline" className="min-h-11" onClick={b.close}>
          Close
        </Button>
      }
    >
      {which === "hours" && <HoursByPlace b={b} week={week} />}
      {which === "open" && <OpenList b={b} week={week} />}
      {which === "ot" && <OverList b={b} week={week} />}
    </DrawerShell>
  );
}
