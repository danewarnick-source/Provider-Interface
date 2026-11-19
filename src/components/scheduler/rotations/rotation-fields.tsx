// The rotation editor's fields: who (a team member or Open) and where, the
// service code (the home's, or the client's active codes), the pattern (with
// weekdays or a custom on/off cycle), the slot (a B2 shift type for that kind
// of place, or any start and end), and when it starts and ends.
import { Input } from "@/components/ui/input";
import { PATTERNS, WEEKDAY_SHORT, maskHas } from "@/lib/scheduler/rotation";
import type { EditorState, RotationPlace } from "@/lib/scheduler/rotation-form";
import { Field } from "@/components/scheduler/board/add-shift-steps";
import { choice } from "@/components/scheduler/board/choice-class";
import type { RotationsData } from "./use-rotations";

type Set = (p: Partial<EditorState>) => void;
const SELECT =
  "min-h-11 w-full rounded-md border border-[var(--hive-border)] bg-[var(--hive-surface)] px-3 text-sm";

export function WhoWhere({ data, s, set }: { data: RotationsData; s: EditorState; set: Set }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Who">
        <select
          autoFocus
          aria-label="Who"
          className={SELECT}
          value={s.who}
          onChange={(e) => set({ who: e.target.value })}
        >
          <option value="">Pick someone…</option>
          <option value="open">Open (an open shift every time)</option>
          {data.staff.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Where">
        <select
          aria-label="Where"
          className={SELECT}
          value={s.placeKey}
          onChange={(e) => {
            const p = data.places.find((x) => x.key === e.target.value);
            set({ placeKey: e.target.value, code: p?.codes[0] ?? "", shiftType: null });
          }}
        >
          {data.places.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function CodeField({ place, s, set }: { place: RotationPlace; s: EditorState; set: Set }) {
  return (
    <Field
      label="Service code"
      hint={place.clientId ? "The client's active 1056 codes." : undefined}
    >
      <div className="flex flex-wrap gap-1.5">
        {place.codes.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={s.code === c}
            className={choice(s.code === c)}
            onClick={() => set({ code: c })}
          >
            {c}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function PatternField({ s, set }: { s: EditorState; set: Set }) {
  return (
    <Field label="Pattern">
      <div className="flex flex-wrap gap-1.5">
        {PATTERNS.map((p) => (
          <button
            key={p.kind}
            type="button"
            aria-pressed={s.kind === p.kind}
            className={choice(s.kind === p.kind)}
            onClick={() => set({ kind: p.kind })}
          >
            {p.label}
          </button>
        ))}
      </div>
      {s.kind === "weekdays" && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
          {WEEKDAY_SHORT.map((d, i) => (
            <button
              key={d}
              type="button"
              aria-pressed={maskHas(s.mask, i)}
              className={choice(maskHas(s.mask, i))}
              onClick={() => set({ mask: s.mask ^ (1 << i) })}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      {s.kind === "custom" && (
        <Input
          aria-label="Days on and off"
          placeholder="6-1"
          className="w-40"
          value={s.customText}
          onChange={(e) => set({ customText: e.target.value })}
        />
      )}
      {s.kind === "custom" && (
        <p className="text-xs text-[var(--hive-text-muted)]">
          Days on and off, starting with on: 6-1 is 6 on, 1 off; 3-2-2-3 is 3 on, 2 off, 2 on, 3
          off.
        </p>
      )}
    </Field>
  );
}

export function SlotField({
  data,
  place,
  s,
  set,
}: {
  data: RotationsData;
  place: RotationPlace;
  s: EditorState;
  set: Set;
}) {
  const types = data.shiftTypes.filter((t) => t.key && t.used_at.includes(place.usedAt));
  return (
    <Field label="Shift">
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {types.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={s.shiftType === t.key}
              className={choice(s.shiftType === t.key)}
              onClick={() =>
                set({
                  shiftType: t.key,
                  start: t.start_time.slice(0, 5),
                  end: t.end_time.slice(0, 5),
                })
              }
            >
              {t.name} · {t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="time"
          aria-label="Starts"
          className="w-auto"
          value={s.start}
          onChange={(e) => e.target.value && set({ start: e.target.value, shiftType: null })}
        />
        <span className="text-xs">to</span>
        <Input
          type="time"
          aria-label="Ends"
          className="w-auto"
          value={s.end}
          onChange={(e) => e.target.value && set({ end: e.target.value, shiftType: null })}
        />
        {s.end <= s.start && (
          <span className="text-xs text-[var(--hive-text-muted)]">ends the next morning</span>
        )}
      </div>
    </Field>
  );
}

export function DatesField({ s, set }: { s: EditorState; set: Set }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label={s.kind === "alt-weekend" ? "First weekend (a Saturday)" : "Cycle starts"}
        hint="The pattern counts from this day."
      >
        <Input
          type="date"
          aria-label="Cycle starts"
          value={s.startsOn}
          onChange={(e) => set({ startsOn: e.target.value })}
        />
      </Field>
      <Field label="Ends">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={!s.endsOn}
            className={choice(!s.endsOn)}
            onClick={() => set({ endsOn: null })}
          >
            Never
          </button>
          <Input
            type="date"
            aria-label="Last day"
            className="w-auto"
            value={s.endsOn ?? ""}
            onChange={(e) => set({ endsOn: e.target.value || null })}
          />
        </div>
      </Field>
    </div>
  );
}
