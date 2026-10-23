import { createFileRoute } from "@tanstack/react-router";
import { HomesTeamsBoard } from "@/components/scheduler/shared/homes-teams-board";

/**
 * Promoted from the old scheduling page so the Homes & Teams board
 * stays reachable independent of the Schedule V2 cut-over.
 *
 * Renders the exact same HomesTeamsBoard component — no logic changes.
 */
export const Route = createFileRoute("/dashboard/homes")({
  head: () => ({ meta: [{ title: "Homes & Teams — Provider Interface" }] }),
  component: HomesPage,
});

function HomesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Homes &amp; Teams</h2>
        <p className="text-sm text-muted-foreground">
          Manage group homes, day programs, staff designations, and client assignments.
        </p>
      </div>
      <HomesTeamsBoard />
    </div>
  );
}
