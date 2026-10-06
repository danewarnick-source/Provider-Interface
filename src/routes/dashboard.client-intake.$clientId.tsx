import { createFileRoute, redirect } from "@tanstack/react-router";
import { redirectUnlessUuidParam } from "@/lib/route-uuid";

/** Old intake runner: redirect to the client's profile (saved links still use it). */
export const Route = createFileRoute("/dashboard/client-intake/$clientId")({
  beforeLoad: ({ params }) => {
    redirectUnlessUuidParam(params.clientId, {
      createTo: "/dashboard/clients/new",
      fallbackTo: "/dashboard/clients",
    });
    throw redirect({
      to: "/dashboard/clients/$clientId",
      params: { clientId: params.clientId },
      search: { tab: "overview" },
      replace: true,
    });
  },
});
