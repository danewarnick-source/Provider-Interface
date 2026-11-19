// The two panels of a Rotations tab: the place's lines (who · pattern · time ·
// code · starts / ends, with Edit and End) and "Next 4 weeks from these
// rotations": per week, the shifts the lines drafted that are still attached,
// how many are open, and their hours. Ended lines stay listed, muted.
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import { isCancelled, shiftHours } from "@/lib/scheduler/board-model";
import { weekSpan } from "@/lib/scheduler/copy-week";
import { HORIZON_DAYS, patternLabel, type RotationLine } from "@/lib/scheduler/rotation";
import type { RotationPlace } from "@/lib/scheduler/rotation-form";
import { addDaysKey, dayKey, weekStartKey } from "@/lib/scheduler/time";
import { CodeTag } from "@/components/scheduler/board/board-ui";
import { isCurrent, type RotationsData } from "./use-rotations";

const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ap = h! < 12 ? "a" : "p";
  const h12 = h! % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}`;
};

const slotLabel = (data: RotationsData, l: RotationLine) => {
  const type = data.shiftTypes.find((t) => t.key && t.key === l.shift_type);
  const span = `${clock(l.start_time_local)}–${clock(l.end_time_local)}`;
  return type ? `${type.name} ${span}` : span;
};

const whoOf = (data: RotationsData, id: string | null) =>
  id ? (data.staff.find((s) => s.id === id)?.name ?? "Team member") : "Open";

function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--hive-border)] bg-[var(--hive-surface)]">
      <div className="border-b border-[var(--hive-border)] px-4 py-3">
        <h2 className="font-bold">{title}</h2>
        <p className="text-xs text-[var(--hive-text-muted)]">{sub}</p>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function RotationLines({
  data,
  place,
  lines,
  today,
  canEdit,
  highlight,
  onAdd,
  onEdit,
  onEnd,
}: {
  data: RotationsData;
  place: RotationPlace;
  lines: RotationLine[];
  today: string;
  canEdit: boolean;
  highlight: string | undefined;
  onAdd: () => void;
  onEdit: (l: RotationLine) => void;
  onEnd: (l: RotationLine) => void;
}) {
  const sorted = [...lines].sort(
    (a, b) => Number(isCurrent(b, today)) - Number(isCurrent(a, today)),
  );
  return (
    <Panel title={place.label} sub={`${place.codes.join(", ")} · one line per person and slot`}>
      {sorted.length === 0 ? (
        <div className="space-y-3 text-sm">
          <p>No rotations for {place.label} yet.</p>
          {canEdit && (
            <Button className="min-h-11" onClick={onAdd}>
              + Add a rotation
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-[var(--hive-border)]">
          {sorted.map((l) => {
            const live = isCurrent(l, today);
            const ends = l.effective_until
              ? `${live ? "ends" : "ended"} ${fmtDay(l.effective_until)}`
              : "never ends";
            return (
              <li
                key={l.id}
                className={`flex flex-wrap items-center gap-2 py-2.5 ${live ? "" : "opacity-60"} ${
                  highlight === l.id ? "rounded-md ring-2 ring-[var(--hive-gold)]" : ""
                }`}
              >
                <span className="min-w-0 flex-1 text-sm">
                  <b>{whoOf(data, l.staff_id)}</b> <CodeTag code={l.service_code} />
                  <span className="block text-xs text-[var(--hive-text-muted)]">
                    {patternLabel(l)} · {slotLabel(data, l)} · starts{" "}
                    {fmtDay(l.cycle_start ?? l.effective_from)} · {ends}
                  </span>
                </span>
                {canEdit && live && (
                  <span className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      aria-label="Edit rotation"
                      onClick={() => onEdit(l)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="min-h-10" onClick={() => onEnd(l)}>
                      End
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function RotationWeeks({
  data,
  lines,
  today,
}: {
  data: RotationsData;
  lines: RotationLine[];
  today: string;
}) {
  const ids = new Set(lines.map((l) => l.id));
  const weeks = new Map<string, { shifts: number; open: number; hours: number }>();
  const last = addDaysKey(today, HORIZON_DAYS - 1);
  for (let w = weekStartKey(today); w <= last; w = addDaysKey(w, 7))
    weeks.set(w, { shifts: 0, open: 0, hours: 0 });
  for (const s of data.shifts) {
    if (!s.pattern_line_id || !ids.has(s.pattern_line_id) || isCancelled(s)) continue;
    const w = weeks.get(weekStartKey(dayKey(s.starts_at)));
    if (!w) continue;
    w.shifts += 1;
    w.open += s.staff_id ? 0 : 1;
    w.hours = Math.round((w.hours + shiftHours(s)) * 10) / 10;
  }
  return (
    <Panel
      title="Next 4 weeks from these rotations"
      sub="Drafts still attached to a rotation. Shifts edited by hand no longer count here."
    >
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-[var(--hive-text-muted)]">
          <tr>
            <th className="py-1 font-semibold">Week</th>
            <th className="py-1 text-right font-semibold">Shifts</th>
            <th className="py-1 text-right font-semibold">Open</th>
            <th className="py-1 text-right font-semibold">Hours</th>
          </tr>
        </thead>
        <tbody>
          {[...weeks].map(([w, n]) => (
            <tr key={w} className="border-t border-[var(--hive-border)]">
              <td className="py-1.5 font-semibold">{weekSpan(w)}</td>
              <td className="py-1.5 text-right tabular-nums">{n.shifts}</td>
              <td
                className={`py-1.5 text-right tabular-nums ${n.open ? "font-bold text-[var(--hive-danger)]" : ""}`}
              >
                {n.open}
              </td>
              <td className="py-1.5 text-right tabular-nums">{n.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-[var(--hive-text-muted)]">
        Approved time off and expired cards turn a rotation's shift into an open shift, which shows
        in Needs you and is offered when you send.
      </p>
    </Panel>
  );
}
