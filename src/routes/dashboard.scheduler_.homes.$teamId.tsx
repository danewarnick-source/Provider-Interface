// Scheduler › a group home's page (B7), opened from a home's name on the
// board. This file reads the home and the week (?week=) from the URL and
// sends people without scheduling access back to the dashboard; the screen is
// components/scheduler/home/home-page.tsx.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAccess } from "@/hooks/use-access";
import { redirectUnlessUuidParam } from "@/lib/route-uuid";
import { HomeWeekPage } from "@/components/scheduler/home/home-page";

type Search = { week?: string };

export const Route = createFileRoute("/dashboard/scheduler_/homes/$teamId")({
  head: () => ({ meta: [{ title: "Home — Provider Interface" }] }),
  beforeLoad: ({ params }) =>
    redirectUnlessUuidParam(params.teamId, { fallbackTo: "/dashboard/scheduler" }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    week: typeof s.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.week) ? s.week : undefined,
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const { teamId } = Route.useParams();
  const { week } = Route.useSearch();
  const navigate = Route.useNavigate();
  const access = useAccess();
  if (access.isLoading)
    return <p className="p-8 text-sm text-[var(--hive-text-muted)]">Loading…</p>;
  if (!access.canCategory("scheduling", "view")) return <Navigate to="/dashboard" replace />;
  return (
    <HomeWeekPage
      teamId={teamId}
      week={week}
      onWeek={(w) => navigate({ search: { week: w }, replace: true })}
    />
  );
}
