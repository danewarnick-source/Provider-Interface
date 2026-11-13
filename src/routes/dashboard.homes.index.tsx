// Old address of the homes board. Homes live in Settings › Homes now.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/homes/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/settings/homes", replace: true });
  },
});
