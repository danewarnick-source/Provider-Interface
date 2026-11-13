// Steps 1–3 of Add shift: Day, Where (homes and programs, then clients under
// each code; only the locked team member's places when locked) and Time (the
// shift types from Settings for that kind of place, or any start and end).
import { Input } from "@/components/ui/input";
import { timesOn, type PlaceOption } from "@/lib/scheduler/board-model";
import { parseLocalDate } from "@/lib/scheduler/time";
import type { AddDraft } from "./board-context";
import type { BoardShiftType } from "@/lib/scheduler/board-data";

const choice = (on: boolean) =>
  `min-h-11 rounded-md border px-3 text-[13px] font-semibold ${on ? "border-[var(--hive-ink)] bg-[var(--hive-ink)] text-white" : "border-[var(--hive-border)] hover:bg-[var(--hive-hover)]"}`;

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-bold">{label}</div>
      {hint && <p className="text-xs text-[var(--hive-text-muted)]">{hint}</p>}
      {children}
    </div>
  );
}

const dayLabel = (d: string) =>
  parseLocalDate(d).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    day: "numeric",
  });

export function DayStep({
  days,
  value,
  onChange,
}: {
  days: string[];
  value: string;
  onChange: (d: string) => void;
}) {
  return (
    <Field label="1. Day">
      <div className="flex flex-wrap gap-1.5">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={value === d}
            className={choice(value === d)}
            onClick={() => onChange(d)}
          >
            {dayLabel(d)}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function WhereStep({
  places,
  value,
  lockedName,
  onChange,
}: {
  places: PlaceOption[];
  value: string | null;
  lockedName: string | null;
  onChange: (p: PlaceOption) => void;
}) {
  return (
    <Field
      label="2. Where"
      hint={
        lockedName
          ? `Places ${lockedName} works: their caseload's clients and homes. Add others in Team members.`
          : undefined
      }
    >
      {places.length ? (
        <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
          {places.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={value === p.key}
              className={choice(value === p.key)}
              onClick={() => onChange(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--hive-text-muted)]">
          {lockedName
            ? `${lockedName} has no clients on their caseload with an active code this day.`
            : "No homes, programs or clients with an active code this day."}
        </p>
      )}
    </Field>
  );
}

export function TimeStep({
  draft,
  types,
  onChange,
}: {
  draft: AddDraft;
  types: BoardShiftType[];
  onChange: (p: Partial<AddDraft>) => void;
}) {
  const t = timesOn(draft.day, draft.start, draft.end);
  const hours =
    Math.round(
      ((new Date(t.ends_at).getTime() - new Date(t.starts_at).getTime()) / 3_600_000) * 100,
    ) / 100;
  const overnight = draft.end <= draft.start;
  return (
    <Field label="3. Time">
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {types.map((ty) => {
            const on =
              draft.shiftType === ty.key &&
              draft.start === ty.start_time.slice(0, 5) &&
              draft.end === ty.end_time.slice(0, 5);
            return (
              <button
                key={`${ty.key}${ty.name}`}
                type="button"
                aria-pressed={on}
                className={choice(on)}
                onClick={() =>
                  onChange({
                    start: ty.start_time.slice(0, 5),
                    end: ty.end_time.slice(0, 5),
                    shiftType: ty.key,
                  })
                }
              >
                {ty.name} · {ty.start_time.slice(0, 5)}–{ty.end_time.slice(0, 5)}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="time"
          aria-label="Starts"
          className="w-auto"
          value={draft.start}
          onChange={(e) => e.target.value && onChange({ start: e.target.value, shiftType: null })}
        />
        <span className="text-xs">to</span>
        <Input
          type="time"
          aria-label="Ends"
          className="w-auto"
          value={draft.end}
          onChange={(e) => e.target.value && onChange({ end: e.target.value, shiftType: null })}
        />
        <span className="text-xs text-[var(--hive-text-muted)]">
          {hours} h{overnight ? " · ends the next morning" : ""}
        </span>
      </div>
    </Field>
  );
}

export function SpotsStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Field label="5. How many open spots?">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            className={choice(value === n)}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </Field>
  );
}
