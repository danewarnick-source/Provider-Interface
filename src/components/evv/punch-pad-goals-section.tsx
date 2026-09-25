import { selectedPill, unselectedPill } from "@/components/evv/toggle-styles";

interface PunchPadGoalsSectionProps {
  goals: string[];
  checkedGoals: Record<string, boolean>;
  baselineChecked: boolean;
  hasGoalSelected: boolean;
  onGoalChange: (goal: string, checked: boolean) => void;
  onBaselineChange: (checked: boolean) => void;
}

export function PunchPadGoalsSection({
  goals,
  checkedGoals,
  baselineChecked,
  hasGoalSelected,
  onGoalChange,
  onBaselineChange,
}: PunchPadGoalsSectionProps) {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-semibold">
        Person-Centered Support Plan (PCSP) Objectives Tracker
      </h3>
      <div className="grid gap-1.5 rounded-md border border-border p-3">
        {goals.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No PCSP goals on file for this individual. Goals come from the uploaded PCSP on the
            client profile. Use baseline monitoring below.
          </p>
        )}
        {goals.map((goal, index) => {
          const id = `goal-${index}`;
          const selected = !!checkedGoals[goal];
          return (
            <label
              key={id}
              htmlFor={id}
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-1.5 text-sm ${
                selected ? selectedPill : unselectedPill
              }`}
            >
              <input
                id={id}
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--amber-600)]"
                checked={selected}
                onChange={(event) => onGoalChange(goal, event.target.checked)}
              />
              <span className="break-words">{goal}</span>
            </label>
          );
        })}
        <div className="my-1 border-t border-dashed border-border" />
        <label
          htmlFor="goal-baseline"
          className={`flex cursor-pointer items-start gap-2 rounded-md border p-1.5 text-sm ${
            baselineChecked ? selectedPill : unselectedPill
          }`}
        >
          <input
            id="goal-baseline"
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--amber-600)]"
            checked={baselineChecked}
            onChange={(event) => onBaselineChange(event.target.checked)}
          />
          <span className="break-words italic text-muted-foreground">
            General baseline monitoring &amp; safety oversight
          </span>
        </label>
      </div>
      {!hasGoalSelected && (
        <p className="text-[11px] text-muted-foreground">
          Select at least one goal worked on this shift.
        </p>
      )}
    </div>
  );
}
