// "Focus for this shift": a light block for the time clock and daily notes.
// Up to 3 goals for the shift's code, each with its first approved strategy;
// "See all" opens goal, support, support details and every strategy bullet.
// Staff's note should reference these (shift-focus.ts).

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Target } from "lucide-react";
import type { GoalView } from "@/lib/clients/plans";
import { shiftFocus } from "@/lib/clients/shift-focus";
import { useApprovedStrategies } from "./hooks/use-approved-strategies";

export function ShiftFocus({
  clientId,
  groups,
  serviceCode,
  className = "",
}: {
  clientId: string | null | undefined;
  /** The client's goals with only the supports for this shift's code. */
  groups: readonly GoalView[];
  serviceCode?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const strategies = useApprovedStrategies(clientId).data;
  const focus = useMemo(() => shiftFocus(groups, strategies ?? []), [groups, strategies]);
  if (!focus.goals.length) return null;

  return (
    <div
      className={`rounded-lg border border-hive-border bg-[var(--hive-muted-surface)] px-3 py-2 text-xs ${className}`}
      data-testid="shift-focus"
    >
      <p className="flex items-center gap-1.5 font-semibold text-hive-ink">
        <Target className="h-3.5 w-3.5" />
        Focus for this shift{serviceCode ? ` (${serviceCode})` : ""}
      </p>
      {!open ? (
        <ul className="mt-1 space-y-0.5">
          {focus.lines.map((l, i) => (
            <li key={i} className="leading-snug">
              <span className="font-medium">{l.goal}</span>
              {l.bullets.map((b, j) => (
                <span key={j} className="block text-muted-foreground">
                  • {b}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 space-y-2">
          {focus.goals.map((g) => (
            <div key={g.id} className="space-y-1">
              <p className="font-medium">Goal: {g.goal}</p>
              {g.supports.map((s) => (
                <div key={s.id} className="space-y-0.5 pl-2">
                  <p>
                    <span className="text-muted-foreground">Support:</span>{" "}
                    {s.support || "Not written"}
                  </p>
                  {s.details ? (
                    <p>
                      <span className="text-muted-foreground">Support details:</span> {s.details}
                    </p>
                  ) : null}
                  {s.bullets.length ? (
                    <ul className="list-disc pl-4">
                      {s.bullets.map((b, k) => (
                        <li key={k}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
          {!focus.hasStrategies ? (
            <p className="text-muted-foreground">
              Support strategies for this client aren't approved yet.
            </p>
          ) : null}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 inline-flex min-h-8 items-center gap-1 font-medium text-hive-ink underline-offset-2 hover:underline max-md:min-h-11"
        aria-expanded={open}
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? "Show less" : "See all goals and strategies"}
      </button>
    </div>
  );
}
