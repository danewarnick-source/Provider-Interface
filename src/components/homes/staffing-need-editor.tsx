// One time block in edit mode: days (first, focused), start and end, staff
// needed, awake overnight, and a note. Save and Cancel sit in place; the
// block saves only when needProblems finds nothing (the reason shows on Save).
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DAY_NAMES,
  MAX_STAFF,
  WEEK_ORDER,
  needProblems,
  type NeedBlock,
} from "@/lib/homes/staffing-needs";

export function StaffingNeedEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: NeedBlock;
  saving: boolean;
  onSave: (b: NeedBlock) => void;
  onCancel: () => void;
}) {
  const [b, setB] = useState(initial);
  const firstDay = useRef<HTMLButtonElement>(null);
  useEffect(() => firstDay.current?.focus(), []);
  const set = (patch: Partial<NeedBlock>) => setB((x) => ({ ...x, ...patch }));
  const toggle = (d: number) =>
    set({
      days: b.days.includes(d)
        ? b.days.filter((x) => x !== d)
        : [...b.days, d].sort((x, y) => x - y),
    });
  const problem = needProblems(b)[0] ?? null;
  const id = initial.ids[0] ?? "new";

  return (
    <div
      className="space-y-3 rounded-xl border border-hive-border p-3"
      data-testid="staffing-need-editor"
    >
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Days</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map((d, i) => (
            <button
              key={d}
              ref={i === 0 ? firstDay : undefined}
              type="button"
              aria-pressed={b.days.includes(d)}
              onClick={() => toggle(d)}
              className={cn(
                "min-h-11 min-w-11 rounded-lg border px-2 text-sm font-medium",
                b.days.includes(d)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-hive-border bg-hive-surface",
              )}
            >
              {DAY_NAMES[d]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`need-start-${id}`}>Start</Label>
          <Input
            id={`need-start-${id}`}
            type="time"
            value={b.start}
            onChange={(e) => set({ start: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`need-end-${id}`}>End</Label>
          <Input
            id={`need-end-${id}`}
            type="time"
            value={b.end}
            onChange={(e) => set({ end: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`need-staff-${id}`}>Staff needed</Label>
          <Input
            id={`need-staff-${id}`}
            type="number"
            min={1}
            max={MAX_STAFF}
            value={Number.isNaN(b.staff) ? "" : b.staff}
            onChange={(e) => set({ staff: e.target.valueAsNumber })}
          />
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <Checkbox checked={b.awake} onCheckedChange={(v) => set({ awake: v === true })} />
        Awake overnight (staff must stay awake)
      </label>
      <div className="grid gap-1.5">
        <Label htmlFor={`need-notes-${id}`}>Note (optional)</Label>
        <Input
          id={`need-notes-${id}`}
          value={b.notes}
          maxLength={500}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {problem ? <span className="mr-auto text-xs text-muted-foreground">{problem}</span> : null}
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={() => onSave(b)}
          disabled={saving || !!problem}
          title={problem ?? undefined}
        >
          {saving ? "Saving…" : initial.ids.length ? "Save time block" : "Add time block"}
        </Button>
      </div>
    </div>
  );
}
