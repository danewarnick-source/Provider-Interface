import { createFileRoute, redirect } from "@tanstack/react-router";

/** Permanent redirect: old /employees links live on in saved notifications and emails. */
export const Route = createFileRoute("/employees/")({
  beforeLoad: ({ location: { hash } }) => {
    throw redirect({ to: "/dashboard/team-members", search: {}, hash, replace: true });
  },
});
