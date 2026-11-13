// One shift on the board: time, code, who or where, and its flag ("! reminder"
// or "✕ block" from the rule engine). Dashed = draft, red = open, grey = cancelled.
// Drag it to another day or person to move it (Alt-drag copies); drag its top or
// bottom edge to change the start or end (every 8 px is 15 minutes). The drop
// handler is in board-grid.tsx. Click opens the shift drawer.
import { useDraggable } from "@dnd-kit/core";
import { classesForCode } from "@/lib/scheduler/code-colors";
import {
  clientName,
  fmtClock,
  fmtSpan,
  isCancelled,
  resizeTimes,
  type BoardShift,
  type View,
} from "@/lib/scheduler/board-model";
import { firstName, shiftFlags, staffName, useBoard, type Board } from "./board-context";
import { CodeTag } from "./board-ui";

export const PX_PER_QUARTER = 8;

export type DragData =
  | { kind: "move"; shift: BoardShift; rowKey: string }
  | { kind: "resize"; shift: BoardShift; edge: "start" | "end" };

export function placeLabel(b: Board, s: BoardShift): string {
  if (s.team_id && b.teams.has(s.team_id)) return b.teams.get(s.team_id)!.team_name;
  return s.client_id ? clientName(b.clients.get(s.client_id)) : "Shift";
}

function subLine(b: Board, s: BoardShift, view: View): string {
  const who =
    view === "staff" ? placeLabel(b, s) : s.staff_id ? firstName(staffName(b, s.staff_id)) : "Open";
  const oneToOne =
    s.team_id && s.client_id ? ` · 1:1 · ${firstName(clientName(b.clients.get(s.client_id)))}` : "";
  return who + oneToOne;
}

function flagLine(b: Board, s: BoardShift): { text: string; bad: boolean } | null {
  if (isCancelled(s)) return { text: "Cancelled", bad: false };
  if (!s.staff_id) {
    if (s.claim_requested_by)
      return { text: `${firstName(staffName(b, s.claim_requested_by))} asked for it`, bad: false };
    return s.published ? { text: "Offered", bad: false } : { text: "Not offered yet", bad: true };
  }
  const flags = shiftFlags(b, s);
  const block = flags.find((f) => f.level === "block");
  if (block) return { text: `✕ ${block.message}`, bad: true };
  return flags[0] ? { text: `! ${flags[0].message}`, bad: false } : null;
}

function Edge({ s, edge, disabled }: { s: BoardShift; edge: "start" | "end"; disabled: boolean }) {
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: `${edge}:${s.id}`,
    data: { kind: "resize", shift: s, edge } satisfies DragData,
    disabled,
  });
  if (disabled) return null;
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={
        edge === "start" ? "Drag to change the start time" : "Drag to change the end time"
      }
      className={`absolute inset-x-1 h-1.5 cursor-ns-resize rounded ${edge === "start" ? "top-0" : "bottom-0"} hover:bg-[var(--hive-gold)]`}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function ShiftChip({ s, view, rowKey }: { s: BoardShift; view: View; rowKey: string }) {
  const b = useBoard();
  const locked = !b.canEdit || isCancelled(s);
  const move = useDraggable({
    id: `move:${rowKey}:${s.id}`,
    data: { kind: "move", shift: s, rowKey } satisfies DragData,
    disabled: locked,
  });
  const flag = flagLine(b, s);
  const c = classesForCode(s.service_code);
  const style = move.transform
    ? { transform: `translate(${move.transform.x}px, ${move.transform.y}px)`, zIndex: 20 }
    : undefined;
  return (
    <div ref={move.setNodeRef} style={style} className="relative mb-1">
      <Edge s={s} edge="start" disabled={locked} />
      <button
        type="button"
        {...move.listeners}
        {...move.attributes}
        onClick={() => b.open({ kind: "shift", id: s.id })}
        className={[
          "block w-full rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight",
          c.border,
          isCancelled(s)
            ? "bg-[var(--hive-muted-surface)] text-[var(--hive-text-muted)] line-through opacity-70"
            : !s.staff_id
              ? "border border-[var(--hive-danger)] bg-[var(--hive-danger-soft)]"
              : "border border-[var(--hive-border)] bg-[var(--hive-surface)]",
          !s.published && !isCancelled(s) ? "border-dashed" : "",
          locked ? "cursor-pointer" : "cursor-grab",
        ].join(" ")}
      >
        <span className="flex items-center gap-1 font-bold">
          {fmtSpan(s)} <CodeTag code={s.service_code} />
          {s.shift_type === "paired" && (
            <span className="text-[10px] font-semibold text-[var(--hive-info)]">paired</span>
          )}
        </span>
        <span className="block truncate">{subLine(b, s, view)}</span>
        {flag && (
          <span
            className={`block truncate font-semibold ${flag.bad ? "text-[var(--hive-danger)]" : "text-[var(--hive-text-muted)]"}`}
          >
            {flag.text}
          </span>
        )}
      </button>
      <Edge s={s} edge="end" disabled={locked} />
    </div>
  );
}

/** The time an edge drag would land on, for the live label while dragging. */
export function resizePreview(s: BoardShift, edge: "start" | "end", dy: number): string {
  const t = resizeTimes(s, edge, (dy / PX_PER_QUARTER) * 15);
  return edge === "start" ? `Starts ${fmtClock(t.starts_at)}` : `Ends ${fmtClock(t.ends_at)}`;
}
