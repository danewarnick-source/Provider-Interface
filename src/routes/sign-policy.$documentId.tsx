// The old typed-signature page (N6): a policy is now marked as reviewed in
// team member Nectar's Policies tab (Decision 4), so this address opens that
// policy there. __root.tsx still sends a person here for an old app-gating
// policy; it lets the Policies tab load so the redirect can't loop.

import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseStaffNectarSearch } from "@/lib/nectar/nectar-nav";

export const Route = createFileRoute("/sign-policy/$documentId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/dashboard/ask-nectar",
      search: parseStaffNectarSearch({ tab: "policies", doc: params.documentId }),
      replace: true,
    });
  },
});
