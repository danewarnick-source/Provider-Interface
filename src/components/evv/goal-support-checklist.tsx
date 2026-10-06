// Clock-out checklist: the client's supports for this shift's code, grouped
// under their goal (plan in effect today). Checking a support records its
// goal_id + support_id on the timesheet.
import { selectedPill, unselectedPill } from "@/components/evv/toggle-styles";
import type { CareGoal } from "@/lib/clients/care-data.functions";

export const BASELINE_GOAL = "General baseline monitoring & safety oversight";

export function GoalSupportChecklist({
  groups,
  serviceCode,
  checked,
  onCheck,
  baselineChecked,
  onBaseline,
}: {
  groups: CareGoal[];
  serviceCode: string | null;
  checked: Record<string, boolean>;
  onCheck: (supportId: string, on: boolean) => void;
  baselineChecked: boolean;
  onBaseline: (on: boolean) => void;
}) {
  const pill = (on: boolean) =>
    `flex cursor-pointer items-start gap-2 rounded-md border p-1.5 text-sm ${on ? selectedPill : unselectedPill}`;
  return (
    <div className="grid gap-1.5 rounded-md border border-border p-3">
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No supports on this person's plan list {serviceCode ?? "this code"}. Use baseline monitoring below
          and let your supervisor know.
        </p>
      )}
      {groups.map((g) => (
        <div key={g.id} className="grid gap-1">
          <p className="text-xs font-semibold text-foreground">{g.goal}</p>
          {g.supports.map((s) => {
            const id = `support-${s.id}`;
            const on = !!checked[s.id];
            return (
              <label key={s.id} htmlFor={id} className={pill(on)}>
                <input
                  id={id}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--amber-600)]"
                  checked={on}
                  onChange={(e) => onCheck(s.id, e.target.checked)}
                />
                <span className="break-words">
                  {s.support_text.trim() || <span className="italic text-muted-foreground">Support not written yet</span>}
                  {s.details?.trim() && <span className="block text-[11px] text-muted-foreground">{s.details}</span>}
                </span>
              </label>
            );
          })}
        </div>
      ))}
      <div className="my-1 border-t border-dashed border-border" />
      <label htmlFor="goal-baseline" className={pill(baselineChecked)}>
        <input
          id="goal-baseline"
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--amber-600)]"
          checked={baselineChecked}
          onChange={(e) => onBaseline(e.target.checked)}
        />
        <span className="break-words italic text-muted-foreground">{BASELINE_GOAL}</span>
      </label>
    </div>
  );
}
