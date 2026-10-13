// Read-only goals → supports → codes for one plan year. Used by the Goals
// and supports card, the client-specific training card and the staff
// training page. Each goal's title is bold and a size up so goals scan
// easily. Supports read "Support: … + codes" / "Support details: …".
import type { ReactNode } from "react";
import type { GoalView } from "@/lib/clients/plans";
import { GOAL_BLOCK, GOAL_HEAD, GOAL_TITLE, SupportLines } from "./support-lines";

export function GoalTree({
  goals,
  empty,
  goalActions,
  supportActions,
  addSupport,
}: {
  goals: GoalView[];
  empty?: ReactNode;
  goalActions?: (goal: GoalView) => ReactNode;
  supportActions?: (goal: GoalView, support: GoalView["supports"][number]) => ReactNode;
  /** Under the goal's supports, e.g. an "Add support" button. */
  addSupport?: (goal: GoalView) => ReactNode;
}) {
  if (goals.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        {empty ?? "No goals on this plan yet."}
      </div>
    );
  }
  return (
    <ul className="space-y-4">
      {goals.map((g) => (
        <li key={g.id} className={GOAL_BLOCK} data-testid="plan-goal">
          <div className={`flex items-start gap-2 ${GOAL_HEAD}`}>
            <div className="min-w-0 flex-1">
              {g.kind === "other_need" ? (
                <p className={GOAL_TITLE}>Other needs in the PCSP</p>
              ) : (
                <>
                  <div className="mb-0.5 text-xs font-medium text-muted-foreground">Goal{g.domain ? ` · ${g.domain}` : ""}</div>
                  <p className={GOAL_TITLE}>{g.goal}</p>
                </>
              )}
            </div>
            {goalActions?.(g)}
          </div>
          <ul className="divide-y divide-hive-steel/30">
            {g.supports.length === 0 && <li className="px-4 py-3 text-xs italic text-muted-foreground">No supports yet.</li>}
            {g.supports.map((s) => (
              <li key={s.id} className="flex items-start gap-2 px-4 py-3">
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
          {addSupport ? <div className="border-t border-hive-steel/30 px-4 py-3">{addSupport(g)}</div> : null}
        </li>
      ))}
    </ul>
  );
}
