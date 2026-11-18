// One line naming a shift on the board, for the Publish and Copy week
// dialogs' lists: "Thu, Oct 22 3p–11p · Maple House · Ava Reyes".
import { fmtSpan } from "@/lib/scheduler/board-model";
import { dayKey, parseLocalDate } from "@/lib/scheduler/time";
import { staffName, type Board } from "./board-context";
import { placeLabel } from "./shift-chip";

export function shiftLabel(b: Board, id: string): string {
  const s = b.shifts.find((x) => x.id === id);
  if (!s) return "A shift outside this week";
  const day = parseLocalDate(dayKey(s.starts_at)).toLocaleDateString("en-US", {
    timeZone: "America/Denver",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${day} ${fmtSpan(s)} · ${placeLabel(b, s)} · ${staffName(b, s.staff_id)}`;
}
