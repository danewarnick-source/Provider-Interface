import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old link: the client list replaced the pending page. */
export const Route = createFileRoute("/dashboard/clients/pending")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/clients", replace: true });
  },
});
