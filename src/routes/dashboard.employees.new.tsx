import { createFileRoute, redirect } from "@tanstack/react-router";

/** Permanent redirect: old links live on in saved notifications and emails. */
export const Route = createFileRoute("/dashboard/employees/new")({
  beforeLoad: ({ location: { hash } }) => {
    throw redirect({ to: "/dashboard/team-members", search: { add: 1 }, hash, replace: true });
  },
});
