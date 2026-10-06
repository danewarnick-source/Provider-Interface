import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyProfileSearch } from "@/lib/team-members/legacy-links";

/** Permanent redirect: old profile links live on in saved notifications and emails. */
export const Route = createFileRoute("/dashboard/employees/$staffId")({
  beforeLoad: ({ params: { staffId }, location: { hash, search } }) => {
    const next = legacyProfileSearch(search);
    const to = "/dashboard/team-members/$staffId";
    throw redirect({ to, params: { staffId }, search: next, hash, replace: true });
  },
});
