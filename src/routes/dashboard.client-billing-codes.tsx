import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// Old org-wide codes page. Codes now live on each client's Billing tab.
export const Route = createFileRoute("/dashboard/client-billing-codes")({
  validateSearch: z.object({ clientId: z.string().uuid().optional() }),
  beforeLoad: ({ search }) => {
    if (search.clientId) {
      throw redirect({
        to: "/dashboard/clients/$clientId",
        params: { clientId: search.clientId },
        search: { tab: "billing" },
        replace: true,
      });
    }
    throw redirect({ to: "/dashboard/clients", replace: true });
  },
});
