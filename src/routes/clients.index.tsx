import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/clients/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/clients", replace: true });
  },
  component: () => null,
});
