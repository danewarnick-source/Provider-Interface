// Old address of a home's page. It lives in Settings › Homes now; the hash
// ("+ Set host" links send #lead) is kept.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/homes/$teamId")({
  beforeLoad: ({ params, location }) => {
    throw redirect({
      to: "/dashboard/settings/homes/$teamId",
      params: { teamId: params.teamId },
      hash: location.hash || undefined,
      replace: true,
    });
  },
});
