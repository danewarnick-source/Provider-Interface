// "From rotation: Maria · 5 on / 2 off" with Open rotation, in the shift
// drawer of a shift a rotation line drafted and nobody has edited by hand
// since (scheduled_shifts.pattern_line_id, B6). Reads the line as the viewer
// (RLS: Scheduling view).
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { patternLabel } from "@/lib/scheduler/rotation";
import { placeKeyOf } from "@/lib/scheduler/rotation-form";
import type { BoardShift } from "@/lib/scheduler/board-model";
import { firstName, staffName, useBoard } from "./board-context";

export function FromRotation({ s }: { s: BoardShift }) {
  const b = useBoard();
  const id = s.pattern_line_id;
  const q = useQuery({
    enabled: !!id,
    queryKey: ["scheduler-board", "rotation-line", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_shift_patterns")
        .select("id, staff_id, team_id, client_id, cycle, cycle_start, weekday_mask")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const line = q.data;
  if (!id || !line) return null;
  const who = line.staff_id ? firstName(staffName(b, line.staff_id)) : "Open";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--hive-border)] px-3 py-2 text-sm">
      <span className="flex-1">
        From rotation: <b>{who}</b> · {patternLabel(line)}
      </span>
      <Link
        to="/dashboard/scheduler/rotations"
        search={{ place: placeKeyOf(line), line: line.id }}
        className="inline-flex min-h-11 items-center rounded-md border border-[var(--hive-border)] px-3 text-[13px] font-semibold"
      >
        Open rotation
      </Link>
    </div>
  );
}
