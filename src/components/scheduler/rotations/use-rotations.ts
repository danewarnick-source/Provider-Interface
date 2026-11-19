// What Scheduler › Rotations shows, loaded once: the board's data for the
// next 4 weeks (homes, clients and their 1056 codes, team members, shift
// types, shifts; board-data.ts) and the agency's rotation lines
// (recurring_shift_patterns, read as the viewer: Scheduling view). The tabs
// come from rotationPlaces(). Both queries sit under "scheduler-board", so a
// save on the board or here refreshes both.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HORIZON_DAYS, type RotationLine } from "@/lib/scheduler/rotation";
import { rotationPlaces } from "@/lib/scheduler/rotation-form";
import { addDaysKey, dayKey, parseLocalDate } from "@/lib/scheduler/time";
import { useBoardData } from "@/components/scheduler/board/use-board-data";

const LINE_SELECT =
  "id, staff_id, client_id, team_id, service_code, shift_type, cycle, cycle_start, weekday_mask, start_time_local, end_time_local, effective_from, effective_until, active";

export function useRotations(orgId: string | undefined) {
  const today = dayKey(new Date());
  const range = useMemo(() => {
    const to = addDaysKey(today, HORIZON_DAYS - 1);
    return {
      from: today,
      to,
      startIso: parseLocalDate(today).toISOString(),
      endIso: parseLocalDate(addDaysKey(to, 1)).toISOString(),
    };
  }, [today]);
  const board = useBoardData(orgId, range);
  const lines = useQuery({
    enabled: !!orgId,
    queryKey: ["scheduler-board", "rotations", orgId],
    queryFn: async (): Promise<RotationLine[]> => {
      const { data, error } = await supabase
        .from("recurring_shift_patterns")
        .select(LINE_SELECT)
        .eq("organization_id", orgId!)
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const data = useMemo(
    () =>
      board.data && lines.data
        ? {
            ...board.data,
            lines: lines.data,
            places: rotationPlaces(board.data.teams, board.data.clients, board.data.codes, today),
          }
        : undefined,
    [board.data, lines.data, today],
  );
  return { data, today, error: board.error ?? lines.error };
}

export type RotationsData = NonNullable<ReturnType<typeof useRotations>["data"]>;

/** A line that still runs today or later. */
export const isCurrent = (l: RotationLine, today: string) =>
  l.active && (!l.effective_until || l.effective_until >= today);
