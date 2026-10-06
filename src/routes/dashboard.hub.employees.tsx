import { createFileRoute, redirect } from "@tanstack/react-router";

/** Permanent redirect: the Employees hub is now Team Members; hosts live under Clients. */
export const Route = createFileRoute("/dashboard/hub/employees")({
  beforeLoad: ({ location: { hash, search } }) => {
    if ((search as { tab?: unknown }).tab === "hosts") {
      const placements = { tab: "placements" as const };
      throw redirect({ to: "/dashboard/hub/clients", search: placements, hash, replace: true });
    }
    throw redirect({ to: "/dashboard/team-members", search: {}, hash, replace: true });
  },
});
