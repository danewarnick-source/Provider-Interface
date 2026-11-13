// Settings › Shift types: what a shift is (default times, where it's used,
// whether it counts toward a home's coverage, how it pays). Built-in types are
// fixed; the agency can add its own and remove them (archived with a reason).
// B3 offers these as time choices when adding a shift.
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  addShiftType,
  removeShiftType,
  setShiftTypeCoverage,
} from "@/lib/scheduler/settings/shift-types.functions";
import type { ShiftType } from "@/lib/scheduler/settings/settings-model";
import { Panel, Segmented, Tag, useSettings } from "./settings-controls";
import { ReasonDialog } from "./reason-dialog";

const USED_AT = { home: "Homes", program: "Day programs", client: "Community" } as const;
const PAY = {
  normal: "Hourly rate",
  sleep: "Home's overnight rule",
  stipend: "Flat on-call stipend",
} as const;
const COLORS = [
  ["#8A3A62", "Plum"],
  ["#B0632A", "Rust"],
  ["#2F7D5B", "Green"],
  ["#2D5A9B", "Blue"],
  ["#6B6B2A", "Olive"],
] as const;
const field = "min-h-11 rounded-md border px-2 text-sm";
const hm = (t: string) => t.slice(0, 5);

function AddTypeForm() {
  const { orgId, save } = useSettings();
  const addFn = useServerFn(addShiftType);
  const nameRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    name: "",
    color: COLORS[0][0] as string,
    startTime: "17:00",
    endTime: "19:00",
    usedAt: "home" as keyof typeof USED_AT,
    counts: true,
    payKind: "normal" as keyof typeof PAY,
  });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  return (
    <div className="border-t border-[var(--hive-border)] py-3">
      <h3 className="mb-2 text-sm font-semibold">Add a shift type</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          Name
          <input
            ref={nameRef}
            className={`${field} w-full`}
            value={f.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Med pass, Split shift, Weekend outing"
          />
        </label>
        <label className="text-xs">
          Color
          <select
            className={`${field} w-full`}
            value={f.color}
            onChange={(e) => set({ color: e.target.value })}
          >
            {COLORS.map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs">
          From / to
          <span className="flex items-center gap-1">
            <input
              type="time"
              aria-label="From"
              className={field}
              value={f.startTime}
              onChange={(e) => set({ startTime: e.target.value })}
            />
            to
            <input
              type="time"
              aria-label="To"
              className={field}
              value={f.endTime}
              onChange={(e) => set({ endTime: e.target.value })}
            />
          </span>
        </span>
        <label className="text-xs">
          Used at
          <select
            className={`${field} w-full`}
            value={f.usedAt}
            onChange={(e) => set({ usedAt: e.target.value as keyof typeof USED_AT })}
          >
            {Object.entries(USED_AT).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Counts toward coverage
          <select
            className={`${field} w-full`}
            value={f.counts ? "1" : "0"}
            onChange={(e) => set({ counts: e.target.value === "1" })}
          >
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>
        <label className="text-xs">
          Pay
          <select
            className={`${field} w-full`}
            value={f.payKind}
            onChange={(e) => set({ payKind: e.target.value as keyof typeof PAY })}
          >
            {Object.entries(PAY).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button
          className="min-h-11"
          disabled={!f.name.trim()}
          title={f.name.trim() ? undefined : "Give it a name first"}
          onClick={async () => {
            const name = f.name.trim();
            const ok = await save(
              () =>
                addFn({
                  data: { organizationId: orgId, ...f, name, countsTowardCoverage: f.counts },
                }),
              `${name} added. It shows as a time choice when adding shifts there.`,
            );
            if (ok) {
              set({ name: "" });
              nameRef.current?.focus();
            }
          }}
        >
          Add shift type
        </Button>
        {!f.name.trim() && (
          <span className="text-xs text-muted-foreground">Give it a name first.</span>
        )}
      </div>
    </div>
  );
}

export function ShiftTypesTab() {
  const { data, orgId, canEdit, save } = useSettings();
  const coverageFn = useServerFn(setShiftTypeCoverage);
  const removeFn = useServerFn(removeShiftType);
  const [removing, setRemoving] = useState<ShiftType | null>(null);
  return (
    <Panel
      title="Shift types"
      sub="What a shift is: its default times, whether it counts toward a home's coverage, and how it pays. You can add your own."
    >
      {data.shiftTypes.map((t) => (
        <div
          key={t.id}
          className="flex flex-col gap-2 border-t border-[var(--hive-border)] py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: t.color }}
              aria-hidden
            />
            <b className="text-sm">{t.name}</b>
            {!t.built_in && <Tag tone="profile">Yours</Tag>}
            <span className="font-mono text-xs text-muted-foreground">
              {hm(t.start_time)}–{hm(t.end_time)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t.used_at.map((u) => USED_AT[u as keyof typeof USED_AT]).join(", ")} ·{" "}
              {PAY[t.pay_kind as keyof typeof PAY]}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Counts toward coverage</span>
            <Segmented
              label={`${t.name} counts toward coverage`}
              readOnly={!canEdit}
              value={t.counts_toward_coverage}
              choices={[
                { value: true, label: "Yes" },
                { value: false, label: "No" },
              ]}
              onPick={(v) =>
                save(
                  () => coverageFn({ data: { organizationId: orgId, typeId: t.id, counts: v } }),
                  `${t.name} ${v ? "counts" : "doesn't count"} toward coverage`,
                )
              }
            />
            {!t.built_in && canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() => setRemoving(t)}
              >
                Remove
              </Button>
            )}
          </span>
        </div>
      ))}
      {canEdit && <AddTypeForm />}
      <ReasonDialog
        open={!!removing}
        title={`Remove ${removing?.name}?`}
        body="It stops showing as a time choice. Shifts that already use it keep it."
        action="Remove shift type"
        onCancel={() => setRemoving(null)}
        onConfirm={(reason) =>
          save(
            () => removeFn({ data: { organizationId: orgId, typeId: removing!.id, reason } }),
            `${removing?.name} removed`,
          )
        }
      />
    </Panel>
  );
}
