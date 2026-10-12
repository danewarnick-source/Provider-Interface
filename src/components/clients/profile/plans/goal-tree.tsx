// Read-only goals → supports → codes for one plan year. Used by the Goals
// and supports card, the client-specific training card and the staff
// training page. Supports read "Support: … + codes" / "Support details: …".
import type { ReactNode } from "react";
import type { GoalView } from "@/lib/clients/plans";
import { SupportLines } from "./support-lines";

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
              {g.kind === "other_need" ? (
                <p className="text-sm font-medium">Other needs in the PCSP</p>
              ) : (
                <>
                  <div className="mb-0.5 text-xs font-medium text-muted-foreground">Goal{g.domain ? ` · ${g.domain}` : ""}</div>
                  <p className="whitespace-pre-wrap text-sm">{g.goal}</p>
                </>
              )}
            </div>
            {goalActions?.(g)}
          </div>
          <ul className="mt-2 space-y-2.5 border-l-2 border-border pl-3">
            {g.supports.length === 0 && <li className="text-xs italic text-muted-foreground">No supports yet.</li>}
            {g.supports.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <SupportLines
                    support={s.support_text}
                    details={s.details}
                    codes={s.our_codes}
                    noCodes={<span className="text-[11px] text-muted-foreground">No agency code: no team member sees this support.</span>}
                  />
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
