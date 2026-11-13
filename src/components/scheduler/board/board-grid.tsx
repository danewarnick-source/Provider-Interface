// The week grid: one row per home, team member or client (board-rows.tsx) and
// one column per day. Drag a chip to another day (or, on Team members, another
// person) to move it; hold Alt while starting the drag to copy it; drag a
// chip's top or bottom edge to change its time. Every drop is saved through
// the rule engine (use-board-actions.ts); a block leaves the chip where it was
// and shows the reason.
import { useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { dayKey, parseLocalDate } from "@/lib/scheduler/time";
import {
  moveTimes,
  nextStatus,
  resizeTimes,
  shiftWrite,
  type BoardShift,
  type View,
} from "@/lib/scheduler/board-model";
import { firstName, staffName, useBoard } from "./board-context";
import type { BoardRow } from "./board-rows";
import { PX_PER_QUARTER, resizePreview, ShiftChip, type DragData } from "./shift-chip";

type DropData = { rowKey: string; day: string; patch?: Partial<BoardShift> };

function Cell({
  row,
  day,
  today,
  children,
}: {
  row: BoardRow;
  day: string;
  today: boolean;
  children: ReactNode;
}) {
  const b = useBoard();
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${row.key}:${day}`,
    data: { rowKey: row.key, day, patch: row.dropPatch } satisfies DropData,
  });
  const draft = b.canEdit && row.addAt ? row.addAt : null;
  return (
    <td
      ref={setNodeRef}
      className={`min-w-[118px] border-l border-[var(--hive-border)] p-1 align-top
      ${today ? "bg-[var(--hive-gold-soft)]/40" : ""} ${isOver ? "outline outline-2 outline-[var(--hive-gold)]" : ""}`}
    >
      {children}
      {draft && (
        <button
          type="button"
          aria-label="Add shift here"
          onClick={() => {
            const d = draft(day);
            if (d) b.open({ kind: "add", draft: d });
          }}
          className="min-h-8 w-full rounded border border-dashed border-[var(--hive-border)] text-sm text-[var(--hive-text-muted)] hover:bg-[var(--hive-hover)]"
        >
          +
        </button>
      )}
    </td>
  );
}

const dayHead = (d: string) =>
  parseLocalDate(d).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    day: "numeric",
  });

export function BoardGrid({
  rows,
  view,
  empty,
}: {
  rows: BoardRow[];
  view: View;
  empty: ReactNode;
}) {
  const b = useBoard();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [resizing, setResizing] = useState<{
    s: BoardShift;
    edge: "start" | "end";
    dy: number;
  } | null>(null);
  const today = dayKey(new Date());

  function onMove(e: DragMoveEvent) {
    const d = e.active.data.current as DragData | undefined;
    setResizing(d?.kind === "resize" ? { s: d.shift, edge: d.edge, dy: e.delta.y } : null);
  }

  function onEnd(e: DragEndEvent) {
    setResizing(null);
    const d = e.active.data.current as DragData | undefined;
    if (!d) return;
    if (d.kind === "resize") {
      const minutes = (e.delta.y / PX_PER_QUARTER) * 15;
      if (Math.abs(minutes) < 7.5) return;
      void b.actions.update(d.shift, resizeTimes(d.shift, d.edge, minutes), "Shift time changed");
      return;
    }
    const over = e.over?.data.current as DropData | undefined;
    if (!over) return;
    const sameRow = over.rowKey === d.rowKey;
    if (!sameRow && !over.patch) {
      toast.error(
        "Drop it on another day in the same row, or use Edit day, place or time to change the place.",
      );
      return;
    }
    const s = d.shift;
    const patch = { ...moveTimes(s, over.day), ...(sameRow ? {} : over.patch) };
    const copy = (e.activatorEvent as PointerEvent | undefined)?.altKey;
    if (copy) {
      const staff = patch.staff_id !== undefined ? patch.staff_id : s.staff_id;
      const {
        id: _id,
        organization_id: _org,
        ...row
      } = shiftWrite(b.orgId, s, {
        ...patch,
        status: nextStatus({ ...s, published: false, staff_id: null }, staff),
        published: false,
      });
      void b.actions.create([row], "Shift copied");
      return;
    }
    if (sameRow && over.day === dayKey(s.starts_at)) return;
    const to =
      patch.staff_id && patch.staff_id !== s.staff_id
        ? ` to ${firstName(staffName(b, patch.staff_id))}`
        : "";
    void b.actions.update(s, patch, `Moved${to}`);
  }

  if (!rows.length) return <div className="px-4 py-10 text-center text-sm">{empty}</div>;
  return (
    <DndContext
      sensors={sensors}
      onDragMove={onMove}
      onDragEnd={onEnd}
      onDragCancel={() => setResizing(null)}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="text-left text-xs text-[var(--hive-text-muted)]">
              <th className="px-3 py-2 font-semibold">
                {view === "homes"
                  ? "Home or program"
                  : view === "staff"
                    ? "Team member · hours"
                    : "Client · 1056"}
              </th>
              {b.days.map((d) => (
                <th
                  key={d}
                  className={`border-l border-[var(--hive-border)] px-2 py-2 font-semibold ${d === today ? "text-[var(--hive-text)]" : ""}`}
                >
                  {dayHead(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-[var(--hive-border)]">
                <td className="px-3 py-2 align-top">{r.head}</td>
                {b.days.map((d) => (
                  <Cell key={d} row={r} day={d} today={d === today}>
                    {r.extrasOn?.(d)}
                    {r.shiftsOn(d).map((s) => (
                      <ShiftChip key={s.id} s={s} view={view} rowKey={r.key} />
                    ))}
                  </Cell>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resizing && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-[var(--hive-ink)] px-3 py-1.5 text-sm font-semibold text-white">
          {resizePreview(resizing.s, resizing.edge, resizing.dy)}
        </div>
      )}
    </DndContext>
  );
}
