// The Coverage gaps list behind the board's tile (B7): every short stretch at
// a staffed home this week, with Handle it (opens the gap dialog).
import { Button } from "@/components/ui/button";
import { allGaps, dayText, minuteSpan, openShiftFor } from "@/lib/scheduler/coverage";
import type { Board } from "./board-context";

export function GapList({ b }: { b: Board }) {
  const gaps = allGaps(b.coverage);
  if (!gaps.length)
    return <p className="text-sm text-[var(--hive-text-muted)]">Every home is covered.</p>;
  return (
    <div className="space-y-2">
      {gaps.map((g) => {
        const open = openShiftFor(g, b.data.shifts);
        return (
          <div
            key={`${g.teamId}|${g.day}|${g.from}`}
            className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--hive-border)] p-2"
          >
            <div className="min-w-0 flex-1 text-sm">
              <b>
                {b.teams.get(g.teamId)?.team_name ?? "Home"} · {dayText(g.day)} · No one{" "}
                {minuteSpan(g.from, g.to)}
              </b>
              <div className="text-xs text-[var(--hive-text-muted)]">
                {open
                  ? "An open shift covers it; nobody is on it yet."
                  : `Short ${g.short}. No shift covers this time.`}
              </div>
            </div>
            <Button className="min-h-11" onClick={() => b.open({ kind: "gap", gap: g })}>
              Handle it
            </Button>
          </div>
        );
      })}
    </div>
  );
}
