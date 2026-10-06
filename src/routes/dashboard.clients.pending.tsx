import { createFileRoute, redirect } from "@tanstack/react-router";

/** Imported drafts now show in the client list with a "Finish setup" tag. */
export const Route = createFileRoute("/dashboard/clients/pending")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/clients", replace: true });
  },
});
