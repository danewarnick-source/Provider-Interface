import { createFileRoute, redirect } from "@tanstack/react-router";

/** Permanent redirect: invitations now live in the roster's Invited view. */
export const Route = createFileRoute("/dashboard/invitations")({
  beforeLoad: ({ location: { hash } }) => {
    const search = { view: "invited" as const };
    throw redirect({ to: "/dashboard/team-members", search, hash, replace: true });
  },
});
