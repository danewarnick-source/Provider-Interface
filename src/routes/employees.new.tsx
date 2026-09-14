import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/employees/new")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/employees/new", replace: true });
  },
  component: () => null,
});
