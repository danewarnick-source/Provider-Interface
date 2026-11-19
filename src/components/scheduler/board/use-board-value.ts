// One scheduler board's shared state (board-context.tsx) for a range of days:
// its data, the rule findings, unsent changes, the change actions and which
// drawer is open. Used by the board (scheduler-board.tsx) and by Needs you,
// which opens the same drawers (Find staff, a shift, the overtime list) on
// the days it lists.
import { useState } from "react";
import { useAccess } from "@/hooks/use-access";
import type { BoardRange } from "@/lib/scheduler/board-data";
import type { Board, Panel } from "./board-context";
import { useBoardActions } from "./use-board-actions";
import { useBoardData, useUnsentChanges, useWeekChecks } from "./use-board-data";

export function useBoardValue(
  orgId: string | undefined,
  range: BoardRange,
  checksRange: { startIso: string; endIso: string },
  days: string[],
) {
  const canEdit = useAccess().canCategory("scheduling", "edit");
  const data = useBoardData(orgId, range);
  const checks = useWeekChecks(orgId, checksRange);
  const actions = useBoardActions(orgId ?? "");
  const changes = useUnsentChanges(orgId);
  const [panel, setPanel] = useState<Panel | null>(null);

  const board: Board | null =
    !orgId || !data.data
      ? null
      : {
          orgId,
          data: data.data,
          checks: checks.data ?? {},
          days,
          canEdit,
          actions,
          clients: new Map(data.data.clients.map((c) => [c.id, c])),
          teams: new Map(data.data.teams.map((t) => [t.id, t])),
          staff: new Map(data.data.staff.map((s) => [s.id, s])),
          shifts: data.data.shifts,
          changes: changes.data ?? [],
          changed: new Set((changes.data ?? []).map((c) => c.shiftId)),
          // A drawer opened from a dialog (Publish › Open shift) goes back to it on close.
          open: (p) =>
            setPanel((cur) =>
              cur?.back && !p.back && p.kind !== "publish" && p.kind !== "copy"
                ? ({ ...p, back: cur.back } as Panel)
                : p,
            ),
          close: () => setPanel((cur) => (cur?.back ? { kind: cur.back } : null)),
        };
  return { board, panel, error: data.error, actions };
}
