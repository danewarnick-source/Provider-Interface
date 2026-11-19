// Coverage by the hour on the home page (B7, demo vPlace / covDay): one row
// per day with what's short ("No one 3p–7p ›", opens the gap dialog) or
// "Covered", the day's "no staff needed" blocks, a 7a-to-7a bar (green =
// covered, red = short, grey = not needed), the day's shifts (open one) and
// + Add shift (Scheduling edit). A red stretch on the bar opens its gap too.
import { Button } from "@/components/ui/button";
import {
  dayText,
  minuteClock,
  minuteSpan,
  type CoverageDay,
  type Gap,
  type Slot,
} from "@/lib/scheduler/coverage";
import { fmtSpan, isCancelled, shiftDay, type BoardShift } from "@/lib/scheduler/board-model";
import { dayKey } from "@/lib/scheduler/time";
import { firstName, staffName, useBoard } from "@/components/scheduler/board/board-context";
import { newDraft } from "@/components/scheduler/board/add-draft";
import { HomePanel } from "./home-panel";

const SLOT_CLASS = {
  covered: "bg-[var(--hive-ok)]",
  short: "bg-[var(--hive-danger)]",
  none: "bg-[var(--hive-muted-surface)]",
} as const;

function slotTitle(s: Slot) {
  const at = minuteClock(s.at);
  if (s.off === "no_staff") return `${at}: no staff needed`;
  if (s.off === "away") return `${at}: every resident is away`;
  if (!s.needed) return `${at}: not needed`;
  return `${at}: ${s.scheduled} of ${s.needed}`;
}

function Bar({ c, onGap }: { c: CoverageDay; onGap: (g: Gap) => void }) {
  return (
    <div className="mt-1 flex h-4 gap-px overflow-hidden rounded" aria-label="7a to 7a">
      {c.slots.map((s) => {
        const gap = c.gaps.find((g) => g.from <= s.at && s.at < g.to);
        return (
          <i
            key={s.at}
            title={slotTitle(s)}
            onClick={gap ? () => onGap(gap) : undefined}
            className={`block flex-1 ${SLOT_CLASS[s.state]} ${gap ? "cursor-pointer" : ""}`}
          />
        );
      })}
    </div>
  );
}

export function CoverageCard({ teamId, days }: { teamId: string; days: string[] }) {
  const b = useBoard();
  const cov = b.coverage.get(teamId);
  const today = dayKey(new Date());
  const shiftsOn = (d: string) =>
    b.shifts
      .filter(
        (s: BoardShift) =>
          s.team_id === teamId &&
          !s.client_id &&
          !s.parent_shift_id &&
          !isCancelled(s) &&
          shiftDay(s) === d,
      )
      .sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  return (
    <HomePanel
      title="Coverage by the hour"
      sub="Green = covered. Red = short. Grey = not needed, marked no staff needed, or every resident is away. Click a red stretch to fill it or mark it. 7a to 7a."
    >
      {!cov ? (
        <p className="text-sm text-[var(--hive-text-muted)]">
          This home has no staffing needs yet, so nothing is counted. Add them with Set up this
          home.
        </p>
      ) : (
        <div className="space-y-4">
          {days.map((d) => {
            const c = cov.find((x) => x.day === d)!;
            return (
              <div key={d}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <b>
                    {dayText(d)}
                    {d === today ? " · today" : ""}
                  </b>
                  <span className="text-xs">
                    {c.gaps.length ? (
                      c.gaps.map((g) => (
                        <button
                          key={g.from}
                          type="button"
                          onClick={() => b.open({ kind: "gap", gap: g })}
                          className="mr-2 min-h-11 font-bold text-[var(--hive-danger)] hover:underline"
                        >
                          No one {minuteSpan(g.from, g.to)}
                          {g.short > 1 ? ` · short ${g.short}` : ""} ›
                        </button>
                      ))
                    ) : (
                      <span className="text-[var(--hive-text-muted)]">
                        {c.neededHours ? "Covered" : "No staff needed"}
                      </span>
                    )}
                    {c.noStaff.map((x) => (
                      <span key={x.id} className="text-[var(--hive-text-muted)]">
                        {" "}
                        · {minuteSpan(x.from, x.to)} no staff needed ({x.reason})
                      </span>
                    ))}
                  </span>
                </div>
                <Bar c={c} onGap={(g) => b.open({ kind: "gap", gap: g })} />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {shiftsOn(d).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => b.open({ kind: "shift", id: s.id })}
                      className={`min-h-9 rounded-full px-2.5 text-xs font-semibold ${
                        s.staff_id
                          ? "bg-[var(--hive-muted-surface)]"
                          : "bg-[var(--hive-danger-soft)] text-[var(--hive-danger)]"
                      }`}
                    >
                      {s.staff_id ? firstName(staffName(b, s.staff_id)) : "Open"} {fmtSpan(s)}
                    </button>
                  ))}
                  {b.canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-9"
                      onClick={() =>
                        b.open({
                          kind: "add",
                          draft: newDraft(b, { day: d, placeKey: `team:${teamId}` }),
                        })
                      }
                    >
                      + Add shift
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </HomePanel>
  );
}
