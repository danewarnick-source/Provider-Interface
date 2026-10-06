// Units left per authorized code, with a marker for where today's pace
// says usage should be (share of the authorization year gone by).

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/clients/dates";
import { OVER_PACE_POINTS, UNITS_LOW_PCT, type CodePace } from "@/lib/clients/readiness";

function barTone(p: CodePace): string {
  if (p.leftPct <= UNITS_LOW_PCT) return "bg-destructive";
  if (p.usedPct - p.elapsedPct >= OVER_PACE_POINTS) return "bg-amber-500";
  return "bg-emerald-500";
}

export function UnitsCard({ paces, loading }: { paces: CodePace[]; loading: boolean }) {
  return (
    <Card data-testid="client-units-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Units left</CardTitle>
        <p className="text-xs text-muted-foreground">
          The line marks where today's pace should be.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : paces.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active authorizations.</p>
        ) : (
          paces.map((p) => (
            <div key={`${p.code}-${p.start}`} data-testid="client-units-row">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-mono font-semibold">{p.code}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {p.pending
                    ? "Waiting on 1056"
                    : p.annual > 0
                      ? `${p.left.toLocaleString()} of ${p.annual.toLocaleString()} left`
                      : "No units on file"}
                </span>
              </div>
              {p.annual > 0 && !p.pending ? (
                <div className="relative mt-1 h-2 rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn("h-2 rounded-full", barTone(p))}
                    style={{ width: `${p.usedPct}%` }}
                  />
                  <div
                    className="absolute -top-0.5 h-3 w-0.5 bg-foreground"
                    style={{ left: `${p.elapsedPct}%` }}
                    title="Today's pace"
                  />
                </div>
              ) : null}
              {p.end ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDate(p.start)} – {formatDate(p.end)}
                </p>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
