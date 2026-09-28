import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyRosterSearch } from "@/lib/team-members/legacy-links";

/** Permanent redirect: old roster links live on in saved notifications and emails. */
export const Route = createFileRoute("/dashboard/employees/")({
  beforeLoad: ({ location: { hash, search } }) => {
    const next = legacyRosterSearch(search);
    throw redirect({ to: "/dashboard/team-members", search: next, hash, replace: true });
  },
});
