import { createFileRoute, redirect } from "@tanstack/react-router";

/** Permanent redirect: the hire-dates page is now the roster's missing-info filter. */
export const Route = createFileRoute("/dashboard/employees/hire-dates")({
  beforeLoad: ({ location: { hash } }) => {
    const search = { filter: "missing_info" };
    throw redirect({ to: "/dashboard/team-members", search, hash, replace: true });
  },
});
