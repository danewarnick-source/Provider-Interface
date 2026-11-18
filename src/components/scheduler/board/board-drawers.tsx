// Opens the drawer or dialog the board asked for: a shift, Add shift (or
// edit), Find staff, a stat tile's list, Publish or Copy week. A shift that's
// no longer loaded closes it. The Publish dialog's typed reasons live here, so
// they survive a trip to a shift's drawer (Open shift) and back.
import { useState } from "react";
import { useBoard, type Panel } from "./board-context";
import { AddShiftDrawer } from "./add-shift-drawer";
import { CopyWeekDialog } from "./copy-week-dialog";
import { FindStaffDrawer } from "./find-staff-drawer";
import { PublishDialog } from "./publish-dialog";
import type { Reasons } from "./publish-checklist";
import { ShiftDrawer } from "./shift-drawer";
import { WeekListDrawer } from "./week-list-drawer";

export function BoardDrawers({ panel }: { panel: Panel | null }) {
  const b = useBoard();
  const [reasons, setReasons] = useState<Reasons>({});
  if (!panel) return null;
  if (panel.kind === "publish") return <PublishDialog reasons={reasons} setReasons={setReasons} />;
  if (panel.kind === "copy") return <CopyWeekDialog />;
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
