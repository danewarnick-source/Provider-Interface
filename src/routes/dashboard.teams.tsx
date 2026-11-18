import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address of Homes & Teams. Homes live in Settings › Homes now.
export const Route = createFileRoute("/dashboard/teams")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/settings/homes", replace: true });
  },
});
