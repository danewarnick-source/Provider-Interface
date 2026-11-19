// Add a rotation / Edit a rotation (the demo's dlgRot), a drawer on the
// Rotations page. The 4-week preview updates as you edit: dates and hours at
// once (rotation.ts, rotation-preview.ts), flags from the rule engine
// (previewRotation) a moment later. Save rotation (saveRotation) builds the
// drafts and stays on the page with a toast; it's disabled, with the reason,
// until who, pattern, slot and start are set. Closing with unsaved changes asks.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { previewRotation, saveRotation } from "@/lib/scheduler/rotation.functions";
import { editorInput, lineFromInput, type EditorState } from "@/lib/scheduler/rotation-form";
import { HORIZON_DAYS, rotationSlots } from "@/lib/scheduler/rotation";
import { rotationPreview, type PreviewWeek } from "@/lib/scheduler/rotation-preview";
import { addDaysKey } from "@/lib/scheduler/time";
import { DrawerShell, Pill } from "@/components/scheduler/board/board-ui";
import { CodeField, DatesField, PatternField, SlotField, WhoWhere } from "./rotation-fields";
import type { RotationsData } from "./use-rotations";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

function PreviewTable({ weeks, checking }: { weeks: PreviewWeek[]; checking: boolean }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-bold">
        Next 4 weeks{" "}
        {checking && <span className="font-normal text-[var(--hive-text-muted)]">· checking…</span>}
      </h3>
      {weeks.length === 0 ? (
        <p className="text-sm text-[var(--hive-text-muted)]">
          No working days in the next 4 weeks.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--hive-border)] rounded-md border border-[var(--hive-border)] text-sm">
          {weeks.map((w) => (
            <li key={w.week} className="space-y-1 px-3 py-2">
              <div className="flex flex-wrap gap-x-3">
                <b className="w-28">{w.label}</b>
                <span>{plural(w.days.length, "day")}</span>
                <span>{w.hours} h</span>
                {w.open > 0 && <Pill tone="crit">{w.open} open</Pill>}
              </div>
              {w.flags.map((f) => (
                <div key={f.text}>
                  <Pill tone={f.tone}>{f.text}</Pill>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RotationEditor({
  orgId,
  data,
  today,
  initial,
  onClose,
}: {
  orgId: string;
  data: RotationsData;
  today: string;
  initial: EditorState;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [s, setS] = useState(initial);
  const set = (p: Partial<EditorState>) => setS((x) => ({ ...x, ...p }));
  const place = data.places.find((p) => p.key === s.placeKey) ?? null;
  const check = editorInput(s, place);
  const input = check.input ? { ...check.input, organization_id: orgId } : null;
  const asked = useDebounced(input, 400);
  const preview = useServerFn(previewRotation);
  const save = useServerFn(saveRotation);
  const q = useQuery({
    enabled: !!asked,
    queryKey: ["scheduler-board", "rotation-preview", asked],
    queryFn: () => preview({ data: asked! }),
    staleTime: 0,
  });
  const slots = check.input
    ? rotationSlots(
        lineFromInput(check.input, s.id ?? "new"),
        today,
        addDaysKey(today, HORIZON_DAYS - 1),
      )
    : [];
  const current = JSON.stringify(asked) === JSON.stringify(input);
  const weeks = rotationPreview(slots, current ? (q.data ?? []) : []);
  const go = useMutation({
    mutationFn: () => save({ data: input! }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["scheduler-board"] });
      void qc.invalidateQueries({ queryKey: ["needs-you"] });
      const open = r.open ? ` · ${r.open} open` : "";
      toast.success(
        s.id
          ? `${plural(r.created + r.updated, "draft")} updated${r.cancelled ? `, ${r.cancelled} cancelled` : ""}; hand-edited shifts left alone${open}`
          : `Rotation saved · ${plural(r.created, "shift")} drafted${open}`,
      );
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const why = check.why ?? (go.isPending ? "Saving…" : null);

  return (
    <DrawerShell
      open
      onClose={onClose}
      dirty={JSON.stringify(s) !== JSON.stringify(initial) && !go.isSuccess}
      unsaved="this rotation"
      kicker="Rotation"
      title={s.id ? "Edit rotation" : "Add a rotation"}
      footer={
        <>
          {why && (
            <span className="mr-auto self-center text-xs text-[var(--hive-text-muted)]">{why}</span>
          )}
          <Button variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="min-h-11"
            disabled={!!why}
            title={why ?? undefined}
            onClick={() => go.mutate()}
          >
            Save rotation
          </Button>
        </>
      }
    >
      <WhoWhere data={data} s={s} set={set} />
      {place && <CodeField place={place} s={s} set={set} />}
      <PatternField s={s} set={set} />
      {place && <SlotField data={data} place={place} s={s} set={set} />}
      <DatesField s={s} set={set} />
      {q.error && current && (
        <p className="text-sm text-[var(--hive-danger)]">
          The checks didn't load: {q.error.message}. The dates below are still right.
        </p>
      )}
      <PreviewTable weeks={weeks} checking={!!input && (!current || q.isFetching)} />
      <p className="text-xs text-[var(--hive-text-muted)]">
        Shifts are drafted 4 weeks ahead and topped up daily. Changing a rotation later only changes
        its unsent drafts; shifts you edit by hand are left alone.
      </p>
    </DrawerShell>
  );
}
