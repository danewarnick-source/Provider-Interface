// Read-only goals → supports → codes for one plan year. Used by the care
// plan panel, the client-specific training card and the staff training page.
import type { ReactNode } from "react";
import type { GoalView } from "@/lib/clients/plans";

export function GoalTree({
  goals,
  empty,
  goalActions,
  supportActions,
}: {
  goals: GoalView[];
  empty?: ReactNode;
  goalActions?: (goal: GoalView) => ReactNode;
  supportActions?: (goal: GoalView, support: GoalView["supports"][number]) => ReactNode;
}) {
  if (goals.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        {empty ?? "No goals on this plan yet."}
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {goals.map((g) => (
        <li key={g.id} className="rounded-lg border border-border/60 bg-card p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-xs font-medium text-muted-foreground">Goal{g.domain ? ` · ${g.domain}` : ""}</div>
              <p className="whitespace-pre-wrap text-sm">{g.goal}</p>
            </div>
            {goalActions?.(g)}
          </div>
          <ul className="mt-2 space-y-1.5 border-l-2 border-border pl-3">
            {g.supports.length === 0 && <li className="text-xs italic text-muted-foreground">No supports yet.</li>}
            {g.supports.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm">
                    {s.support_text.trim() || <span className="italic text-muted-foreground">Support not written yet</span>}
                  </p>
                  {s.details?.trim() && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{s.details}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.our_codes.length === 0 ? (
                      <span className="text-[11px] text-amber-700">No codes — no team member sees this support.</span>
                    ) : (
                      s.our_codes.map((c) => (
                        <span key={c} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{c}</span>
                      ))
                    )}
                  </div>
                </div>
                {supportActions?.(g, s)}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
