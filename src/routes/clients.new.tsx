import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/clients/new")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/clients/new", replace: true });
  },
  component: () => null,
});
