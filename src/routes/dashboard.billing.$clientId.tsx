// Old per-client billing page. Authorizations now live in the client
// profile's Services & billing section (End instead of delete, Fill from
// 1056, units and pace), so this link redirects there.

import { createFileRoute, redirect } from "@tanstack/react-router";
import { redirectUnlessUuidParam } from "@/lib/route-uuid";

export const Route = createFileRoute("/dashboard/billing/$clientId")({
  beforeLoad: ({ params }) => {
    redirectUnlessUuidParam(params.clientId, {
      createTo: "/dashboard/clients/new",
      fallbackTo: "/dashboard/billing",
    });
    throw redirect({
      to: "/dashboard/clients/$clientId",
      params: { clientId: params.clientId },
      search: { section: "services" },
      replace: true,
    });
  },
});
