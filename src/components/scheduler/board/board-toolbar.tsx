// The stat tiles (scheduled hours, open shifts, people over the overtime
// threshold; each opens its list) and the toolbar (Week / Month, the three
// views, and the place filter). The coverage-gaps tile waits for B7.
import {
  filterOptions,
  isCancelled,
  isOpenShift,
  shiftHours,
  staffHours,
  type FilterKey,
  type Range,
  type View,
} from "@/lib/scheduler/board-model";
import { dayKey } from "@/lib/scheduler/time";
import { useBoard } from "./board-context";

function Tile({
  value,
  label,
  tone,
  onClick,
}: {
  value: string;
  label: string;
  tone?: "crit" | "warn";
  onClick: () => void;
}) {
  const color =
    tone === "crit"
      ? "text-[var(--hive-danger)]"
      : tone === "warn"
        ? "text-[var(--hive-gold)]"
        : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 flex-1 rounded-lg border border-[var(--hive-border)] bg-[var(--hive-surface)] px-4 py-3 text-left hover:bg-[var(--hive-hover)]"
    >
      <div className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-[var(--hive-text-muted)]">{label}</div>
    </button>
  );
}

export function StatTiles() {
  const b = useBoard();
  const week = b.shifts.filter((s) => !isCancelled(s) && b.days.includes(dayKey(s.starts_at)));
  const staffed = week.filter((s) => s.staff_id);
  const hours = Math.round(staffed.reduce((n, s) => n + shiftHours(s), 0) * 10) / 10;
  const open = week.filter(isOpenShift).length;
  const over = b.data.staff.filter((p) => staffHours(week, p.id) > b.data.otHours).length;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Tile
        value={`${hours} h`}
        label={`Scheduled · ${staffed.length} shifts · by place ›`}
        onClick={() => b.open({ kind: "list", which: "hours" })}
      />
      <Tile
        value={String(open)}
        tone={open ? "crit" : undefined}
        label="Open shifts · show them ›"
        onClick={() => b.open({ kind: "list", which: "open" })}
      />
      <Tile
        value={String(over)}
        tone={over ? "warn" : undefined}
        label={`People over ${b.data.otHours} h · show them ›`}
        onClick={() => b.open({ kind: "list", which: "ot" })}
      />
    </div>
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <span
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md border border-[var(--hive-border)]"
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`min-h-11 px-3 text-[13px] font-semibold ${value === v ? "bg-[var(--hive-ink)] text-white" : "hover:bg-[var(--hive-hover)]"}`}
        >
          {text}
        </button>
      ))}
    </span>
  );
}

export function BoardToolbar({
  range,
  view,
  filter,
  onChange,
}: {
  range: Range;
  view: View;
  filter: FilterKey;
  onChange: (p: { range?: Range; view?: View; show?: FilterKey }) => void;
}) {
  const b = useBoard();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hive-border)] px-4 py-3">
      <Seg
        label="Range"
        value={range}
        options={[
          ["week", "Week"],
          ["month", "Month"],
        ]}
        onChange={(v) => onChange({ range: v })}
      />
      <Seg
        label="View"
        value={view}
        onChange={(v) => onChange({ view: v })}
        options={[
          ["homes", "Homes & programs"],
          ["staff", "Team members"],
          ["clients", "Clients"],
        ]}
      />
      <span className="text-xs text-[var(--hive-text-muted)]">Show</span>
      {filterOptions(b.data.teams).map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={filter === f.key}
          onClick={() => onChange({ show: f.key })}
          className={`min-h-11 rounded-full border px-3 text-[13px] font-semibold ${
            filter === f.key
              ? "border-[var(--hive-ink)] bg-[var(--hive-ink)] text-white"
              : "border-[var(--hive-border)] hover:bg-[var(--hive-hover)]"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
