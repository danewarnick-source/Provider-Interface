// Opens the drawer the board asked for: a shift, Add shift (or edit), Find
// staff, or a stat tile's list. A shift that's no longer loaded closes it.
import { useBoard, type Panel } from "./board-context";
import { AddShiftDrawer } from "./add-shift-drawer";
import { FindStaffDrawer } from "./find-staff-drawer";
import { ShiftDrawer } from "./shift-drawer";
import { WeekListDrawer } from "./week-list-drawer";

export function BoardDrawers({ panel }: { panel: Panel | null }) {
  const b = useBoard();
  if (!panel) return null;
  if (panel.kind === "add")
    return <AddShiftDrawer key={JSON.stringify(panel.draft)} initial={panel.draft} />;
  if (panel.kind === "list") return <WeekListDrawer which={panel.which} />;
  const s = b.shifts.find((x) => x.id === panel.id);
  if (!s) return null;
  return panel.kind === "find" ? (
    <FindStaffDrawer key={s.id} s={s} />
  ) : (
    <ShiftDrawer key={s.id} s={s} />
  );
}
