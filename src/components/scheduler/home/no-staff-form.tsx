// The "no staff needed" fields (B7): why, a required explanation, from–to and
// how often (just one date, or every week on some days). Shared by the gap
// dialog's "Or: no staff needed for this time" and the home page's + New
// block. Controlled: the parent holds the draft and saves it.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtDay } from "@/lib/scheduler/auth-outlook";
import { NO_STAFF_WHY, type NoStaffDraft } from "@/lib/homes/no-staff";
import { DAY_NAMES, WEEK_ORDER } from "@/lib/homes/staffing-needs";

export function Choice({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3 text-[13px] font-semibold ${
        on
          ? "border-[var(--hive-ink)] bg-[var(--hive-ink)] text-white"
          : "border-[var(--hive-border)] hover:bg-[var(--hive-hover)]"
      }`}
    >
      {children}
    </button>
  );
}

export function DayChoices({
  days,
  onChange,
}: {
  days: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
      {WEEK_ORDER.map((d) => (
        <Choice
          key={d}
          on={days.includes(d)}
          onClick={() =>
            onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort())
          }
        >
          {DAY_NAMES[d]}
        </Choice>
      ))}
    </div>
  );
}

export function NoStaffForm({
  draft,
  onChange,
  idPrefix,
  dateFixed,
}: {
  draft: NoStaffDraft;
  onChange: (d: NoStaffDraft) => void;
  idPrefix: string;
  /** The gap dialog's date ("Just Mon, Nov 16"); without it a date field shows. */
  dateFixed?: boolean;
}) {
  const set = (p: Partial<NoStaffDraft>) => onChange({ ...draft, ...p });
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Why</Label>
        <div className="flex flex-wrap gap-1.5">
          {NO_STAFF_WHY.map((w) => (
            <Choice key={w} on={draft.why === w} onClick={() => set({ why: w })}>
              {w}
            </Choice>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-note`}>Explanation (required)</Label>
        <Textarea
          id={`${idPrefix}-note`}
          rows={2}
          value={draft.explanation}
          placeholder="e.g. All three residents are at Lehi Day Program 9a–3p"
          onChange={(e) => set({ explanation: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-from`}>From</Label>
          <Input
            id={`${idPrefix}-from`}
            type="time"
            value={draft.start}
            onChange={(e) => set({ start: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-to`}>To</Label>
          <Input
            id={`${idPrefix}-to`}
            type="time"
            value={draft.end}
            onChange={(e) => set({ end: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label>How often</Label>
        <div className="flex flex-wrap gap-1.5">
          <Choice on={draft.often === "once"} onClick={() => set({ often: "once" })}>
            {dateFixed && draft.date ? `Just ${fmtDay(draft.date)}` : "One date"}
          </Choice>
          <Choice on={draft.often === "weekly"} onClick={() => set({ often: "weekly" })}>
            Every week
          </Choice>
        </div>
      </div>
      {draft.often === "once" && !dateFixed ? (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-date`}>Date</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
          />
        </div>
      ) : null}
      {draft.often === "weekly" ? (
        <DayChoices days={draft.days} onChange={(days) => set({ days })} />
      ) : null}
      <p className="text-xs text-[var(--hive-text-muted)]">
        The time stops counting as a gap, and the reason stays on the schedule for a reviewer. An
        end at or before the start runs into the next morning; the same time is all day.
      </p>
    </div>
  );
}
