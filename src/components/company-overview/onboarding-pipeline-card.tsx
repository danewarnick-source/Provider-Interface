import { Link } from "@tanstack/react-router";
import { UserPlus, Activity, CheckCircle2, ArrowRight } from "lucide-react";

export type PipelineCounts = { invited: number; inProgress: number; complete: number };

export function OnboardingPipelineCard({ counts }: { counts: PipelineCounts }) {
  const total = counts.invited + counts.inProgress + counts.complete;
  const stages = [
    { key: "invited", label: "Invited", value: counts.invited, icon: UserPlus, view: "invited" },
    {
      key: "in_progress",
      label: "In progress",
      value: counts.inProgress,
      icon: Activity,
      view: undefined,
    },
    {
      key: "complete",
      label: "Complete",
      value: counts.complete,
      icon: CheckCircle2,
      view: undefined,
    },
  ] as const;
  // Every stage opens the roster; Invited lands on its Invited view.

  return (
    <section className="rounded-[var(--denim-r)] border border-line bg-paper p-5 shadow-[var(--denim-shadow)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-deep">
          Onboarding pipeline
        </h2>
        <Link
          to="/dashboard/team-members"
          className="inline-flex items-center gap-1 text-xs font-medium text-pri hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-pt2 bg-pt0 p-4 text-sm text-muted-foreground">
          No one in the pipeline yet — invite your first staff member from Quick actions.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-3">
          {stages.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.key}>
                <Link
                  to="/dashboard/team-members"
                  search={s.view ? { view: s.view } : {}}
                  className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3 py-3 transition hover:border-pt2 hover:bg-pt0"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-pt text-pri">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="font-display text-xl font-bold tabular-nums text-deep">
                      {s.value}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
