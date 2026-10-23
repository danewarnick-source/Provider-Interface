import { createFileRoute, redirect } from "@tanstack/react-router";

/** The PBA ledger now lives in each client's profile, under Money. */
export const Route = createFileRoute("/dashboard/pba-ledger")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/clients", replace: true });
  },
});
