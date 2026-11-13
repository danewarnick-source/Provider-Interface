// Settings › Homes › one home: its details, residents, staffing needs, team,
// scheduling settings, and Archive.
import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/homes/home-page";
import { redirectUnlessUuidParam } from "@/lib/route-uuid";

export const Route = createFileRoute("/dashboard/settings/homes/$teamId")({
  head: () => ({ meta: [{ title: "Home — Provider Interface" }] }),
  beforeLoad: ({ params }) =>
    redirectUnlessUuidParam(params.teamId, { fallbackTo: "/dashboard/settings/homes" }),
  component: HomeRoute,
});

function HomeRoute() {
  const { teamId } = Route.useParams();
  return <HomePage teamId={teamId} />;
}
