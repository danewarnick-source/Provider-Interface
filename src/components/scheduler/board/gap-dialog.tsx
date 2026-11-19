// The coverage gap dialog (B7, demo dlgGap): opened from a red stretch on the
// home page, a "No one 3p–7p ›" bar on the board, the Coverage gaps list and
// a Needs you row. It recounts the gap from the loaded board (so a filled gap
// says so), then offers the fix: Find staff / Offer for the open shift that
// overlaps it, or Add a shift for this time (Add shift, prefilled); or marks
// the time "no staff needed" with a reason, just that day or every week.
// Fixes are hidden without Scheduling edit.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  dayText,
  homeCoverage,
  minuteSpan,
  onCalendar,
  openShiftFor,
  toMinutes,
  type Gap,
} from "@/lib/scheduler/coverage";
import { fmtSpan } from "@/lib/scheduler/board-model";
import { noStaffProblem, type NoStaffDraft } from "@/lib/homes/no-staff";
import { weekdayOf } from "@/lib/scheduler/time";
import { useCoverageActions } from "@/components/scheduler/home/use-coverage-actions";
import { NoStaffForm } from "@/components/scheduler/home/no-staff-form";
import { useBoard, type Board } from "./board-context";
import { newDraft } from "./add-draft";
import { DrawerShell } from "./board-ui";

/** The gap as it stands now on the loaded board, or null when it's covered. */
function currentGap(b: Board, gap: Gap): Gap | null {
  const c = b.data.coverage;
  const day = homeCoverage({
    teamId: gap.teamId,
    needs: c.needs,
    away: c.away,
    residents: c.residents.filter((r) => r.team_id === gap.teamId).map((r) => r.id),
    shifts: b.data.shifts,
    notCounted: new Set(c.notCounted),
    days: [gap.day],
  })[0];
  return day?.gaps.find((g) => g.from < gap.to && g.to > gap.from) ?? null;
}

export function GapDialog({ gap }: { gap: Gap }) {
  const b = useBoard();
  const act = useCoverageActions(b.orgId);
  const now = useMemo(() => currentGap(b, gap), [b, gap]);
  const g = now ?? gap;
  const cal = onCalendar(g.day, g.from, g.to);
  const [draft, setDraft] = useState<NoStaffDraft>({
    why: "",
    explanation: "",
    start: cal.start,
    end: cal.end,
    often: "once",
    date: cal.day,
    days: [weekdayOf(cal.day)],
  });
  const home = b.teams.get(g.teamId)?.team_name ?? "Home";
  const open = now ? openShiftFor(now, b.data.shifts) : null;
  const span = minuteSpan(g.from, g.to);
  const problem = noStaffProblem(draft);
  const why = !now
    ? "Covered now: someone is on a shift for this time, or it no longer needs staff."
    : open
      ? `The ${fmtSpan(open)} shift is open${open.published ? "" : " and not offered yet"}.`
      : `Needs ${g.short} more ${g.short === 1 ? "person" : "people"}. No shift covers this time.`;

  const addShift = () => {
    const d = newDraft(b, { day: cal.day, placeKey: `team:${g.teamId}` });
    b.open({ kind: "add", draft: { ...d, start: cal.start, end: cal.end, shiftType: null } });
  };
  const save = async () => {
    const ok = await act.saveNoStaff(
      g.teamId,
      draft,
      `No staff needed ${minuteSpan(toMinutes(draft.start), toMinutes(draft.end))} saved`,
    );
    if (ok) b.close();
  };

  return (
    <DrawerShell
      open
      onClose={b.close}
      kicker={`${home} · ${dayText(g.day)}`}
      title="Coverage gap"
      dirty={!!draft.explanation.trim()}
      unsaved="this reason"
      footer={
        <>
          <Button variant="outline" className="min-h-11" onClick={b.close}>
            Cancel
          </Button>
          {b.canEdit && now && (
            <Button
              className="min-h-11"
              disabled={!!problem || act.busy}
              title={problem ?? undefined}
              onClick={() => void save()}
            >
              Mark no staff needed
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm">
        <b className="text-[var(--hive-danger)]">No one {span}</b> · {why}
      </p>
      {b.canEdit && now && (
        <>
          <div className="flex flex-wrap gap-2">
            {open ? (
              <>
                <Button className="min-h-11" onClick={() => b.open({ kind: "find", id: open.id })}>
                  Find staff for the open shift
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void b.actions.offer([open.id])}
                >
                  {open.published ? "Offer again" : "Offer to qualified"}
                </Button>
              </>
            ) : (
              <Button className="min-h-11" onClick={addShift}>
                Add a shift for this time
              </Button>
            )}
          </div>
          <section className="space-y-2 rounded-lg border border-[var(--hive-border)] p-3">
            <h3 className="text-sm font-bold">Or: no staff needed for this time</h3>
            <p className="text-xs text-[var(--hive-text-muted)]">
              For when no one is at the house: everyone is at day program, away with family, in the
              hospital.
            </p>
            <NoStaffForm draft={draft} onChange={setDraft} idPrefix="gap" dateFixed />
            {problem && draft.explanation ? (
              <p className="text-xs text-[var(--hive-danger)]">{problem}</p>
            ) : null}
          </section>
        </>
      )}
    </DrawerShell>
  );
}
