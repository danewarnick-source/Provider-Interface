// Month view: each day's count of staffed shifts and open shifts, for the
// current filter. Click a day to open its week.
import { addDaysKey, dayKey, weekStartKey, weekdayOf } from "@/lib/scheduler/time";
import {
  inFilter,
  isCancelled,
  isOpenShift,
  shiftDay,
  shiftPlace,
  type FilterKey,
} from "@/lib/scheduler/board-model";
import { useBoard } from "./board-context";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthView({
  month,
  filter,
  onPickWeek,
}: {
  month: string;
  filter: FilterKey;
  onPickWeek: (week: string) => void;
}) {
  const b = useBoard();
  const first = `${month.slice(0, 7)}-01`;
  const next = addDaysKey(`${month.slice(0, 7)}-28`, 4).slice(0, 7);
  const days: string[] = [];
  for (let d = first; d.slice(0, 7) !== next; d = addDaysKey(d, 1)) days.push(d);
  const today = dayKey(new Date());
  const live = b.shifts.filter(
    (s) =>
      !isCancelled(s) && !s.parent_shift_id && inFilter(filter, shiftPlace(s, b.clients, b.teams)),
  );
  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-7 gap-1 text-xs">
        {DOW.map((d) => (
          <div key={d} className="text-center font-bold text-[var(--hive-text-muted)]">
            {d}
          </div>
        ))}
        {Array.from({ length: weekdayOf(first) }, (_, i) => (
          <div key={`pad${i}`} />
        ))}
        {days.map((d) => {
          const list = live.filter((s) => shiftDay(s) === d);
          const open = list.filter(isOpenShift).length;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickWeek(weekStartKey(d))}
              className={`min-h-16 rounded-md border border-[var(--hive-border)] p-1.5 text-left hover:bg-[var(--hive-hover)]
                ${d === today ? "ring-2 ring-[var(--hive-gold)]" : ""}`}
            >
              <b>{Number(d.slice(8))}</b>
              <div>
                {list.length - open} shifts
                {open > 0 && (
                  <span className="font-bold text-[var(--hive-danger)]"> · {open} open</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
