import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ROSTER_FILTERS,
  ROSTER_FILTER_EMPTY,
  ROSTER_FILTER_LABEL,
  toggleRosterFilter,
  type RosterFilter,
} from "@/lib/team-members/roster";

/**
 * One filter at a time: a click replaces the current filter, clicking the
 * active one clears it. The active button is solid; a button with nobody in
 * it is disabled and says why on hover.
 */
export function RosterFilterButtons({
  filter,
  counts: filterCounts,
  onChange,
}: {
  filter: RosterFilter | null;
  counts: Record<RosterFilter, number>;
  onChange: (patch: { filter: RosterFilter | null }) => void;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <div
        role="group"
        aria-label="Filter team members"
        className="flex flex-wrap items-center gap-2"
      >
        {ROSTER_FILTERS.map((f) => {
          const on = filter === f;
          const count = filterCounts[f];
          // An active filter stays clickable at 0 so it can be cleared.
          const empty = count === 0 && !on;
          const button = (
            <button
              type="button"
              aria-pressed={on}
              disabled={empty}
              data-testid={`roster-filter-${f}`}
              onClick={() => onChange({ filter: toggleRosterFilter(filter, f) })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                empty && "pointer-events-none opacity-50",
              )}
            >
              {ROSTER_FILTER_LABEL[f]}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  on
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
          if (!empty) return <span key={f}>{button}</span>;
          // Disabled buttons swallow pointer events; the wrapper carries the tooltip.
          return (
            <Tooltip key={f}>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={ROSTER_FILTER_EMPTY[f]}
                  className="inline-flex cursor-not-allowed"
                >
                  {button}
                </span>
              </TooltipTrigger>
              <TooltipContent>{ROSTER_FILTER_EMPTY[f]}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
