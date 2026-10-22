// Units used against an authorization, with a line where today's pace says
// usage should be. Shared by the Overview units card and Services & billing.

import { cn } from "@/lib/utils";
import { OVER_PACE_POINTS, UNITS_LOW_PCT, type CodePace } from "@/lib/clients/readiness";

function barTone(p: CodePace): string {
  if (p.leftPct <= UNITS_LOW_PCT) return "bg-[var(--hive-danger)]";
  if (p.usedPct - p.elapsedPct >= OVER_PACE_POINTS) return "bg-hive-gold";
  return "bg-[var(--hive-ok)]";
}

export function UnitsBar({ pace }: { pace: CodePace }) {
  return (
    <div className="relative mt-1 h-2 rounded-full bg-[var(--hive-muted-surface)]" aria-hidden>
      <div
        className={cn("h-2 rounded-full", barTone(pace))}
        style={{ width: `${pace.usedPct}%` }}
      />
      <div
        className="absolute -top-0.5 h-3 w-0.5 bg-hive-ink"
        style={{ left: `${pace.elapsedPct}%` }}
        title="Today's pace"
      />
    </div>
  );
}
