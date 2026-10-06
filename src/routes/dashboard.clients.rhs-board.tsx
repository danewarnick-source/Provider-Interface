import { createFileRoute, redirect } from "@tanstack/react-router";

/** The standalone RHS planning board was retired; old bookmarks land on the hub. */
export const Route = createFileRoute("/dashboard/clients/rhs-board")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/hub/clients" });
  },
});
